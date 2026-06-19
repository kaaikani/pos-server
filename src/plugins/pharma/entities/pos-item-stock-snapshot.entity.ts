import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Live current-stock cache, one row per item. Updated atomically inside the
 * same transaction as every PosStockLedger insert via `writeLedger()`.
 *
 * **Single source of truth for live inventory.** All stock READS in V1 must
 * go through this table, not `PharmaItem.minStkQty` (legacy) or
 * `PharmaItem.currentStock` (V1 mirror).
 *
 * Reconciliation invariant:
 *   SUM(pos_stock_ledger.qty WHERE itemId=X) == pos_item_stock_snapshot.currentStock
 */
@Entity()
@Index('UQ_snapshot_item_warehouse', ['itemId', 'warehouseId'], { unique: true })
export class PosItemStockSnapshot extends VendureEntity {
    constructor(input?: DeepPartial<PosItemStockSnapshot>) {
        super(input);
    }

    @Column({ type: 'integer' }) itemId!: number;

    /** Reserved for V2 multi-warehouse. NULL in V1 means default location. */
    @Column({ type: 'integer', nullable: true }) warehouseId!: number | null;

    /** Live current stock in BASE unit of the item. */
    @Column({ type: 'float', default: 0 }) currentStock!: number;

    /** V2 will mutate this from reservation flows. V1 always 0. */
    @Column({ type: 'float', default: 0 }) reservedQty!: number;
}
