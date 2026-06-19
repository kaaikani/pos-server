import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { RecordStatus } from '../types/pos-types';

@Entity()
export class PosPurchaseReturn extends VendureEntity {
    constructor(input?: DeepPartial<PosPurchaseReturn>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) retNo!: string;
    @Column({ type: 'varchar' }) retDate!: string;
    @Column({ type: 'integer', nullable: true }) originalPurchaseId!: number | null;
    @Column({ type: 'varchar', default: '' }) supplier!: string;
    @Column({ type: 'varchar', default: '' }) address!: string;

    // ───── GST compliance (Step 4) — debit note fields ─────
    @Column({ type: 'varchar', default: '' }) supplierGstin!: string;
    @Column({ type: 'varchar', default: '' }) placeOfSupply!: string;
    @Column({ type: 'text', nullable: true }) rowsJson!: string | null;
    @Column({ type: 'float', default: 0 }) totalAmount!: number;
    @Column({ type: 'float', default: 0 }) totalDisc!: number;
    @Column({ type: 'float', default: 0 }) totalTax!: number;
    @Column({ type: 'float', default: 0 }) netAmount!: number;
    @Column({ type: 'varchar', default: '' }) reason!: string;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
}
