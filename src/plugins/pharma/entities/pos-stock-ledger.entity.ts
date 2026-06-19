import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Immutable stock movement journal. Once a row is inserted it MUST NEVER be
 * updated or deleted. Corrections happen via reversing entries (CANCEL/RETURN).
 *
 * Source of truth for stock AUDIT. Source of truth for current stock is the
 * companion `PosItemStockSnapshot` table, which is updated atomically inside
 * the same transaction as every ledger write via `writeLedger()` in
 * pharma.service.ts.
 *
 * Reconciliation invariant (continuously verified):
 *   SUM(pos_stock_ledger.qty WHERE itemId=X) == pos_item_stock_snapshot.currentStock
 */
@Entity()
@Index('IDX_ledger_item_created', ['itemId', 'createdAt'])
@Index('IDX_ledger_ref', ['refType', 'refId'])
export class PosStockLedger extends VendureEntity {
    constructor(input?: DeepPartial<PosStockLedger>) {
        super(input);
    }

    @Column({ type: 'integer' }) itemId!: number;
    @Column({ type: 'varchar' }) itemCode!: string;

    /**
     * Movement type. PURCHASE / SALE etc. add/subtract; *_CANCEL reverses;
     * *_RETURN follows return semantics; ADJUSTMENT_* covers manual ops;
     * OPENING is the initial backfill row per item.
     */
    @Column({ type: 'varchar' }) refType!:
        | 'OPENING'
        | 'PURCHASE'
        | 'PURCHASE_CANCEL'
        | 'SALE'
        | 'SALE_CANCEL'
        | 'PURCHASE_RETURN'
        | 'PURCHASE_RETURN_CANCEL'
        | 'SALE_RETURN'
        | 'SALE_RETURN_CANCEL'
        | 'ADJUSTMENT_ADD'
        | 'ADJUSTMENT_REMOVE'
        | 'ADJUSTMENT_CANCEL';

    /** FK to source record id (e.g. pharma_purchase.id). 0 for OPENING. */
    @Column({ type: 'integer', default: 0 }) refId!: number;
    /** Human ref (purNo / billNo / retNo / adjNo). */
    @Column({ type: 'varchar', default: '' }) refNo!: string;

    /** Movement date as recorded by the source doc (dd/mm/yyyy). */
    @Column({ type: 'varchar', default: '' }) movementDate!: string;

    /**
     * Signed delta in BASE unit of the item. Positive = stock in, negative = stock out.
     * Convert to base via convertToBaseUnit() before writing.
     */
    @Column({ type: 'float' }) qty!: number;

    /** Unit code as supplied by the caller (informational; qty is already in base). */
    @Column({ type: 'varchar', default: '' }) unit!: string;

    /** Snapshot.currentStock immediately BEFORE this row was written. */
    @Column({ type: 'float', default: 0 }) previousBalance!: number;
    /** Snapshot.currentStock immediately AFTER this row was written (== previousBalance + qty). */
    @Column({ type: 'float', default: 0 }) runningBalance!: number;

    /** Reserved for V2 multi-warehouse. NULL in V1. */
    @Column({ type: 'integer', nullable: true }) warehouseId!: number | null;

    @Column({ type: 'varchar', default: '' }) reason!: string;

    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
}
