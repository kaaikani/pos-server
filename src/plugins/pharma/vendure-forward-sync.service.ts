import { Inject, Injectable } from '@nestjs/common';
import {
    EventBus,
    ProductService,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    TaxCategoryService,
    TransactionalConnection,
} from '@vendure/core';
import { AsyncLocalStorage } from 'async_hooks';

import { PharmaItem } from './entities/pharma-item.entity';
import { PosItemStockSnapshot } from './entities/pos-item-stock-snapshot.entity';
import { PosTaxMaster } from './entities/pos-tax-master.entity';

/**
 * Loop-prevention marker. When forward-sync (POS → Vendure) is in progress,
 * VendureReverseSyncService must skip the resulting ProductVariantEvent to
 * avoid an infinite Pharma ↔ Vendure ↔ Pharma loop.
 *
 * Both services check this flag via `posOriginStorage.getStore()?.active`.
 */
export const posOriginStorage = new AsyncLocalStorage<{ active: true; depth: number }>();

export function isPosOrigin(): boolean {
    return !!posOriginStorage.getStore()?.active;
}

/**
 * Wraps a callback in a posOrigin marker so the reverse-sync listener can
 * detect the loop and bail out. Depth-counter is a belt-and-braces guard.
 */
export function runAsPosOrigin<T>(fn: () => Promise<T>): Promise<T> {
    const prev = posOriginStorage.getStore();
    const depth = (prev?.depth || 0) + 1;
    if (depth > 2) {
        console.warn('[VendureForwardSync] depth-counter tripped — refusing to recurse.');
        return Promise.resolve(undefined as any);
    }
    return posOriginStorage.run({ active: true, depth }, fn);
}

/**
 * POS → Vendure synchroniser. Pushes PharmaItem CRUD into Vendure Product +
 * ProductVariant and keeps stockOnHand mirrored.
 *
 * On every call into Vendure services we wrap the call in `runAsPosOrigin()`
 * so VendureReverseSyncService can detect & skip the resulting event.
 *
 * V1 scope: name, slug, sku, price, taxCategory (by code), trackInventory.
 * Image upload + variant deletion are exposed as separate admin mutations.
 */
@Injectable()
export class VendureForwardSyncService {
    constructor(
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
        @Inject(RequestContextService) private requestContextService: RequestContextService,
        @Inject(ProductService) private productService: ProductService,
        @Inject(ProductVariantService) private productVariantService: ProductVariantService,
        @Inject(TaxCategoryService) private taxCategoryService: TaxCategoryService,
        @Inject(EventBus) private eventBus: EventBus,
    ) {}

    private async resolveTaxCategoryId(ctx: RequestContext, item: PharmaItem): Promise<string | undefined> {
        // Prefer PosTaxMaster.code → Vendure TaxCategory.name match
        if (item.taxMasterId != null) {
            const tax = await this.connection
                .getRepository(ctx, PosTaxMaster)
                .findOne({ where: { id: item.taxMasterId } as any });
            if (tax) {
                try {
                    const list = await this.taxCategoryService.findAll(ctx);
                    const found = list.items.find(t => t.name === tax.code || t.name === tax.name);
                    if (found) return String(found.id);
                } catch {
                    // ignore; fall through
                }
            }
        }
        return undefined;
    }

    /**
     * Best-effort upsert. Failures are LOGGED but do not throw — local POS
     * writes must succeed even if Vendure is temporarily unreachable. The
     * caller (PharmaService) catches and ignores too.
     */
    async upsertProductFromItem(ctx: RequestContext, item: PharmaItem): Promise<void> {
        try {
            await runAsPosOrigin(async () => {
                const sku = item.code;
                if (!sku) return;
                const priceMinor = Math.round((Number(item.salesRate) || 0) * 100);
                if (priceMinor <= 0) return; // Vendure rejects 0-price variants

                // Locate existing variant by SKU
                const variantRepo = this.connection.rawConnection.getRepository('ProductVariant');
                const existingVariant: any = await variantRepo
                    .createQueryBuilder('v')
                    .where('v.sku = :sku', { sku })
                    .andWhere('v.deletedAt IS NULL')
                    .getOne();

                if (existingVariant && item.vendureVariantId == null) {
                    // First-time linkage from a Vendure-originated variant — record IDs.
                    item.vendureProductId = Number(existingVariant.productId);
                    item.vendureVariantId = Number(existingVariant.id);
                    await this.connection.getRepository(ctx, PharmaItem).save(item);
                }

                const taxCategoryId = await this.resolveTaxCategoryId(ctx, item);

                if (existingVariant) {
                    await this.productVariantService.update(ctx, [
                        {
                            id: existingVariant.id,
                            sku,
                            price: priceMinor,
                            ...(taxCategoryId ? { taxCategoryId } : {}),
                            trackInventory: item.isStockBased ? 'TRUE' : 'FALSE' as any,
                        },
                    ]);
                } else {
                    // Create new Product + Variant.
                    const slug = String(item.code).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
                    const product = await this.productService.create(ctx, {
                        translations: [
                            {
                                languageCode: 'en' as any,
                                name: item.itemName,
                                slug,
                                description: '',
                            },
                        ],
                    });
                    const variants = await this.productVariantService.create(ctx, [
                        {
                            productId: product.id,
                            sku,
                            price: priceMinor,
                            ...(taxCategoryId ? { taxCategoryId } : {}),
                            translations: [{ languageCode: 'en' as any, name: item.itemName }],
                            optionIds: [],
                            stockOnHand: 0,
                            trackInventory: item.isStockBased ? 'TRUE' : 'FALSE' as any,
                        } as any,
                    ]);
                    item.vendureProductId = Number(product.id);
                    item.vendureVariantId = variants[0] ? Number(variants[0].id) : null;
                    await this.connection.getRepository(ctx, PharmaItem).save(item);
                }
            });
        } catch (err: any) {
            console.warn('[VendureForwardSync] upsertProductFromItem failed:', err?.message || err);
        }
    }

    /**
     * Push the snapshot's currentStock to Vendure's ProductVariant.stockOnHand.
     * Called from PharmaService after every writeLedger commit.
     *
     * **Hardened (Fix 4)** to guarantee no failure can ever bubble up and
     * break a local POS write:
     *   - Table-existence cached probe; if `stock_level` is missing we no-op
     *     after a single startup warning.
     *   - All exceptions caught and logged with debounce (one log per item
     *     per 60 s) so a misconfigured Vendure schema can't spam logs.
     *   - No throw paths from this method, ever.
     */
    private stockLevelTableProbed = false;
    private stockLevelTableUsable = true;
    private warnedItems = new Map<number, number>(); // itemId -> last warn ts (ms)

    private async probeStockLevelTable(): Promise<void> {
        if (this.stockLevelTableProbed) return;
        this.stockLevelTableProbed = true;
        try {
            await this.connection.rawConnection.query(
                'SELECT 1 FROM stock_level LIMIT 1',
            );
            this.stockLevelTableUsable = true;
        } catch (err: any) {
            this.stockLevelTableUsable = false;
            console.warn(
                '[VendureForwardSync] stock_level table not usable — Vendure stock mirroring disabled:',
                err?.message || err,
            );
        }
    }

    private warnDebounced(itemId: number, msg: string, err: any) {
        const now = Date.now();
        const last = this.warnedItems.get(itemId) || 0;
        if (now - last > 60_000) {
            console.warn(`[VendureForwardSync] ${msg}:`, err?.message || err);
            this.warnedItems.set(itemId, now);
        }
    }

    async syncStockOnHand(ctx: RequestContext, item: PharmaItem): Promise<void> {
        try {
            await this.probeStockLevelTable();
            if (!this.stockLevelTableUsable) return;
            if (!item.vendureVariantId) return;

            await runAsPosOrigin(async () => {
                try {
                    const snap = await this.connection
                        .getRepository(ctx, PosItemStockSnapshot)
                        .findOne({ where: { itemId: Number(item.id), warehouseId: null } as any });
                    const target = snap ? Math.max(0, Math.round(Number(snap.currentStock))) : 0;

                    // Verify the variant still exists before issuing the UPDATE.
                    const variantRows = await this.connection.rawConnection.query(
                        'SELECT id FROM product_variant WHERE id = ? LIMIT 1',
                        [item.vendureVariantId],
                    );
                    if (!variantRows || variantRows.length === 0) return;

                    await this.connection.rawConnection.query(
                        'UPDATE stock_level SET stockOnHand = ? WHERE productVariantId = ?',
                        [target, item.vendureVariantId],
                    );
                } catch (err: any) {
                    this.warnDebounced(Number(item.id), `syncStockOnHand inner failure for item ${item.code}`, err);
                }
            });
        } catch (err: any) {
            // Belt-and-braces: even the outer runAsPosOrigin / probe must never
            // throw upward into writeLedger → withTransaction.
            this.warnDebounced(Number(item.id), `syncStockOnHand outer failure for item ${item.code}`, err);
        }
    }

    /**
     * Admin bootstrap: iterate every PharmaItem and upsert into Vendure. Used
     * once after first deploying forward sync so the Vendure shopfront catches
     * up with all POS-originated products.
     */
    async syncAllItemsToVendure(ctx: RequestContext): Promise<number> {
        const items = await this.connection.getRepository(ctx, PharmaItem).find({ take: 10000 });
        let n = 0;
        for (const it of items) {
            await this.upsertProductFromItem(ctx, it);
            n++;
        }
        return n;
    }
}
