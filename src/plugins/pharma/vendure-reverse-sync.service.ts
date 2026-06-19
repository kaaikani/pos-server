import { Inject, Injectable } from '@nestjs/common';
import {
    EventBus,
    ProductVariant,
    ProductVariantEvent,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { PharmaItem } from './entities/pharma-item.entity';
import { isPosOrigin } from './vendure-forward-sync.service';

/**
 * Listens for Vendure ProductVariant create/update/delete events and keeps
 * the local PharmaItem table in sync.
 *
 *  created/updated → upsert a PharmaItem with the matching SKU as code
 *  deleted         → remove the matching PharmaItem
 *
 * Variants created by the POS sync command already insert their own PharmaItem
 * first, so the create path here is idempotent (skips if code already exists).
 */
@Injectable()
export class VendureReverseSyncService {
    constructor(
        @Inject(EventBus) eventBus: EventBus,
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
        @Inject(RequestContextService) private requestContextService: RequestContextService,
    ) {
        eventBus.ofType(ProductVariantEvent).subscribe(async event => {
            // M5 — Loop guard: if the event was triggered by our own forward
            // sync (POS → Vendure), skip the reverse path or we'd ping-pong
            // forever.
            if (isPosOrigin()) {
                return;
            }
            try {
                if (event.type === 'created' || event.type === 'updated') {
                    await this.syncVariants(event.ctx, event.entity);
                } else if (event.type === 'deleted') {
                    await this.deleteVariants(event.ctx, event.entity);
                }
            } catch (err: any) {
                console.warn('[VendureReverseSync] failed:', err?.message ?? err);
            }
        });
    }

    async deleteVariants(ctx: RequestContext, variants: ProductVariant | ProductVariant[]): Promise<void> {
        const list = Array.isArray(variants) ? variants : [variants];
        const repo = this.connection.getRepository(ctx, PharmaItem);
        for (const v of list) {
            if (!v) continue;
            const sku = String(v.sku || '').trim();
            if (!sku) continue;
            const item = await repo.findOne({ where: { code: sku } });
            if (item) {
                await repo.remove(item);
                console.log(
                    `[VendureReverseSync] Deleted PharmaItem code=${sku} (variant removed in Vendure)`,
                );
            }
        }
    }

    async syncVariants(ctx: RequestContext, variants: ProductVariant | ProductVariant[]): Promise<void> {
        const list = Array.isArray(variants) ? variants : [variants];
        const repo = this.connection.getRepository(ctx, PharmaItem);

        for (const v of list) {
            if (!v) continue;
            const sku = String(v.sku || '').trim();
            if (!sku) continue;

            const existing = await repo.findOne({ where: { code: sku } });
            if (existing) {
                const priceMajor = (v.price || 0) / 100;
                if (
                    priceMajor > 0 &&
                    Math.abs((existing.salesRate || 0) - priceMajor) > 0.001
                ) {
                    existing.salesRate = priceMajor;
                    await repo.save(existing);
                }
                continue;
            }

            const itemName =
                (v.translations && v.translations[0] && v.translations[0].name) ||
                (v as any).name ||
                `Vendure Item ${sku}`;
            const priceMajor = (v.price || 0) / 100;

            // Skip auto-create when variant has no price — the new Item Master
            // validation requires salesRate > 0, and a zero-price stub would block
            // every subsequent sale flow. The user can complete the item in the
            // Item Master form when they actually need to sell it.
            if (priceMajor <= 0) {
                console.warn(
                    `[VendureReverseSync] Skipping PharmaItem auto-create for SKU=${sku} (variant price is 0). Add it manually via Item Master.`,
                );
                continue;
            }

            const item = new PharmaItem({
                code: sku,
                itemName,
                tamilName: '',
                category: 'Na',
                groupName: 'General',
                brand: '',
                hsnCode: '',
                barcode: sku,
                upcCode: '',
                unit: 'NOS',
                packingUnit: '',
                size: '',
                taxName: 'GST 5%',
                mfr: '',
                purchaseRate: 0,
                purchaseTaxMode: 'Without Tax',
                salesRate: priceMajor,
                salesTaxMode: 'Without Tax',
                salesDiscountPct: 0,
                salesDiscountFlat: 0,
                salesDiscountType: 'Percentage',
                mrpRate: priceMajor,
                baseUnitId: null,
                secondaryUnitId: null,
                conversionRate: 1,
                costRate: 0,
                cRate: 0,
                rateA: priceMajor,
                rateB: priceMajor,
                rateC: priceMajor,
                rateD: priceMajor,
                lastPurchaseRate: 0,
                lastSaleRate: 0,
                gstPercent: 5,
                discount: 0,
                profitMargin: 0,
                incentivePct: 0,
                batchNo: '',
                mfgDate: '',
                expiryDate: '',
                serialNo: '',
                minStock: 0,
                maxStock: 0,
                minStkQty: 0,
                maxStkQty: 0,
                isWeightBased: false,
                isExpiryEnabled: true,
                allowExpiry: false,
                isStockBased: false,
                sizesJson: '[]',
            });

            await repo.save(item);
            console.log(
                `[VendureReverseSync] Created PharmaItem from variant SKU=${sku}, name="${itemName}"`,
            );
        }
    }
}
