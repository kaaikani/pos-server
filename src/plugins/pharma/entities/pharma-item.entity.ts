import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { DiscountType, TaxMode } from '../types/pos-types';

@Entity()
export class PharmaItem extends VendureEntity {
    constructor(input?: DeepPartial<PharmaItem>) {
        super(input);
    }

    @Column({ type: 'varchar', default: '', unique: true }) code!: string;
    @Column({ type: 'varchar' }) itemName!: string;
    @Column({ type: 'varchar', default: '' }) tamilName!: string;
    @Column({ type: 'varchar', default: 'Na' }) category!: string;
    @Column({ type: 'varchar', default: 'General' }) groupName!: string;
    @Column({ type: 'varchar', default: '' }) brand!: string;
    @Column({ type: 'varchar', default: '' }) hsnCode!: string;
    @Column({ type: 'varchar', default: '' }) barcode!: string;
    @Column({ type: 'varchar', default: '' }) upcCode!: string;
    @Column({ type: 'varchar', default: 'NA' }) unit!: string;
    @Column({ type: 'varchar', default: '' }) packingUnit!: string;
    @Column({ type: 'varchar', default: '' }) size!: string;
    @Column({ type: 'varchar', default: 'GST 5%' }) taxName!: string;
    @Column({ type: 'varchar', default: '' }) mfr!: string;

    @Column({ type: 'float', default: 0 }) purchaseRate!: number;
    @Column({ type: 'varchar', default: 'Without Tax' }) purchaseTaxMode!: TaxMode;

    @Column({ type: 'float', default: 0 }) salesRate!: number;
    @Column({ type: 'varchar', default: 'Without Tax' }) salesTaxMode!: TaxMode;
    @Column({ type: 'float', default: 0 }) salesDiscountPct!: number;
    @Column({ type: 'float', default: 0 }) salesDiscountFlat!: number;
    @Column({ type: 'varchar', default: 'Percentage' }) salesDiscountType!: DiscountType;

    @Column({ type: 'float', default: 0 }) mrpRate!: number;

    @Column({ type: 'integer', nullable: true }) baseUnitId!: number | null;
    @Column({ type: 'integer', nullable: true }) secondaryUnitId!: number | null;
    @Column({ type: 'float', default: 1 }) conversionRate!: number;

    /** @deprecated Legacy column, kept for DB compatibility. Use PosItemPriceTier instead. */
    @Column({ type: 'float', default: 0 }) costRate!: number;
    /** @deprecated Legacy column. Use PosItemPriceTier instead. */
    @Column({ type: 'float', default: 0 }) cRate!: number;
    /** @deprecated Legacy column. Use PosItemPriceTier instead. */
    @Column({ type: 'float', default: 0 }) rateA!: number;
    /** @deprecated Legacy column. Use PosItemPriceTier instead. */
    @Column({ type: 'float', default: 0 }) rateB!: number;
    /** @deprecated Legacy column. Use PosItemPriceTier instead. */
    @Column({ type: 'float', default: 0 }) rateC!: number;
    /** @deprecated Legacy column. Use PosItemPriceTier instead. */
    @Column({ type: 'float', default: 0 }) rateD!: number;

    @Column({ type: 'float', default: 0 }) lastPurchaseRate!: number;
    @Column({ type: 'float', default: 0 }) lastSaleRate!: number;
    @Column({ type: 'float', default: 5 }) gstPercent!: number;
    @Column({ type: 'float', default: 0 }) discount!: number;
    @Column({ type: 'float', default: 0 }) profitMargin!: number;
    @Column({ type: 'float', default: 0 }) incentivePct!: number;
    @Column({ type: 'varchar', default: '' }) batchNo!: string;
    @Column({ type: 'varchar', default: '' }) mfgDate!: string;
    @Column({ type: 'varchar', default: '' }) expiryDate!: string;
    @Column({ type: 'varchar', default: '' }) serialNo!: string;
    @Column({ type: 'float', default: 0 }) minStock!: number;
    @Column({ type: 'float', default: 0 }) maxStock!: number;
    /**
     * @deprecated V1 transition mirror. Source of truth is PosItemStockSnapshot.currentStock.
     * Updated automatically inside writeLedger(). Never mutate directly.
     */
    @Column({ type: 'float', default: 0 }) minStkQty!: number;
    /**
     * V1 transition mirror, populated from PosItemStockSnapshot inside writeLedger().
     * READ from snapshot table in new code; this column is only for back-compat surfacing.
     */
    @Column({ type: 'float', default: 0 }) currentStock!: number;
    @Column({ type: 'float', default: 0 }) maxStkQty!: number;
    @Column({ type: 'boolean', default: false }) isWeightBased!: boolean;
    @Column({ type: 'boolean', default: true }) isExpiryEnabled!: boolean;
    @Column({ type: 'boolean', default: false }) allowExpiry!: boolean;
    @Column({ type: 'boolean', default: false }) isStockBased!: boolean;
    @Column({ type: 'text', nullable: true }) sizesJson!: string | null;

    // ───── M2 — Item Master upgrades ─────
    /** PRODUCT requires purchaseRate; SERVICE skips stock validation. */
    @Column({ type: 'varchar', default: 'PRODUCT' }) itemType!: 'PRODUCT' | 'SERVICE';

    /** Opening stock at item creation. Written into the ledger as `refType=OPENING`. */
    @Column({ type: 'float', default: 0 }) openingQty!: number;
    @Column({ type: 'float', default: 0 }) openingValue!: number;
    @Column({ type: 'varchar', default: '' }) openingStockDate!: string;

    /** Threshold below which "reorder" alert fires (separate from minStock). */
    @Column({ type: 'float', default: 0 }) reorderLevel!: number;

    /** Image (uploaded via Vendure AssetService; mirrored back into Vendure). */
    @Column({ type: 'varchar', default: '' }) imageUrl!: string;
    @Column({ type: 'integer', nullable: true }) imageAssetId!: number | null;

    /** Vendure linkage — populated by VendureForwardSyncService on item save. */
    @Column({ type: 'integer', nullable: true }) vendureProductId!: number | null;
    @Column({ type: 'integer', nullable: true }) vendureVariantId!: number | null;

    /** TaxMaster FK — preferred over legacy taxName + gstPercent. */
    @Column({ type: 'integer', nullable: true }) taxMasterId!: number | null;

    /** Display flag — does the saved salesRate already include tax? */
    @Column({ type: 'boolean', default: false }) priceIncludesTax!: boolean;

    /** Inventory valuation (currentStock * costRate). Recomputed in writeLedger callers. */
    @Column({ type: 'float', default: 0 }) stockValue!: number;

    /** V1: always false. V2 will turn on batch tracking sub-table. */
    @Column({ type: 'boolean', default: false }) isBatchTracked!: boolean;
    /** V1: always false. V2 will turn on serial tracking sub-table. */
    @Column({ type: 'boolean', default: false }) isSerialTracked!: boolean;

    /** Audit (M2). */
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
    @Column({ type: 'integer', nullable: true }) updatedByAdminId!: number | null;

    // ───── Fix 2 — Soft-cancel for Items (replaces hard delete) ─────
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: 'ACTIVE' | 'CANCELLED';
    @Column({ type: 'datetime', nullable: true }) cancelledAt!: Date | null;
    @Column({ type: 'integer', nullable: true }) cancelledByAdminId!: number | null;
    @Column({ type: 'varchar', default: '' }) cancelReason!: string;
}
