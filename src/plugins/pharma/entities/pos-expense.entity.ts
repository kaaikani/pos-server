import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { RecordStatus } from '../types/pos-types';

@Entity()
export class PosExpense extends VendureEntity {
    constructor(input?: DeepPartial<PosExpense>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) expenseNo!: string;
    @Column({ type: 'varchar' }) expenseDate!: string;
    @Column({ type: 'integer', nullable: true }) categoryId!: number | null;
    @Column({ type: 'varchar', default: '' }) categoryName!: string;
    @Column({ type: 'boolean', default: false }) gstApplied!: boolean;
    @Column({ type: 'varchar', default: 'Cash' }) payType!: string;

    // ───── GST compliance (Step 4) ─────
    @Column({ type: 'varchar', default: '' }) vendorName!: string;
    @Column({ type: 'varchar', default: '' }) vendorGstin!: string;
    /** Vendor's bill/invoice number + date (for ITC matching). */
    @Column({ type: 'varchar', default: '' }) billNumber!: string;
    @Column({ type: 'varchar', default: '' }) billDate!: string;
    @Column({ type: 'varchar', default: '' }) placeOfSupply!: string;
    /** Whether the GST on this expense can be claimed as ITC. */
    @Column({ type: 'boolean', default: true }) itcClaimable!: boolean;
    @Column({ type: 'text', nullable: true }) rowsJson!: string | null;
    @Column({ type: 'float', default: 0 }) roundOff!: number;
    @Column({ type: 'float', default: 0 }) totalAmount!: number;
    @Column({ type: 'float', default: 0 }) netAmount!: number;
    @Column({ type: 'varchar', default: '' }) description!: string;
    @Column({ type: 'varchar', default: '' }) remarks!: string;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
}
