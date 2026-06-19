import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Per-item allowed-units table — one row per (item × unit). Replaces the
 * legacy single `secondaryUnitId/conversionRate` columns on PharmaItem with
 * N rows per item so the same item can transact in multiple units
 * (e.g., Water Bottle: PCS (base) + BOX of 20 + CTN of 240).
 *
 * **Convention (locked):** `conversionRate = "how many base-units in 1 of this unit"`.
 *  - Base row: conversionRate = 1, isBase = true
 *  - "1 BOX = 20 PCS" with base=PCS → row { unitId: BOX.id, conversionRate: 20 }
 *  - convertToBaseUnit(qty_in_thisUnit) = qty × conversionRate
 *
 * Exactly one row per item must have isBase=true (enforced at service layer).
 */
@Entity()
@Index('UQ_item_unit', ['itemId', 'unitId'], { unique: true })
@Index('IDX_item_unit_item', ['itemId'])
export class PosItemUnit extends VendureEntity {
    constructor(input?: DeepPartial<PosItemUnit>) {
        super(input);
    }

    @Column({ type: 'integer' }) itemId!: number;
    @Column({ type: 'integer' }) unitId!: number;

    /** "how many BASE units in 1 of this unit"; base row = 1. */
    @Column({ type: 'float', default: 1 }) conversionRate!: number;

    @Column({ type: 'boolean', default: false }) isBase!: boolean;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: 'ACTIVE' | 'CANCELLED';
}
