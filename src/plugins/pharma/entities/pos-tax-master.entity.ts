import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/**
 * Centralised tax master. Items reference one row by `taxMasterId`. Vendure
 * forward sync resolves the matching TaxCategory by `code` (see VendureForwardSyncService).
 *
 * Seeded with standard Indian GST + IGST slabs on plugin bootstrap if empty.
 */
@Entity()
export class PosTaxMaster extends VendureEntity {
    constructor(input?: DeepPartial<PosTaxMaster>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) code!: string;
    @Column({ type: 'varchar' }) name!: string;
    @Column({ type: 'float', default: 0 }) ratePercent!: number;
    @Column({ type: 'varchar', default: 'GST_EXCLUSIVE' }) taxType!:
        | 'GST_INCLUSIVE'
        | 'GST_EXCLUSIVE'
        | 'IGST'
        | 'EXEMPT'
        | 'CUSTOM';
    @Column({ type: 'boolean', default: false }) isDefault!: boolean;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: 'ACTIVE' | 'CANCELLED';
}
