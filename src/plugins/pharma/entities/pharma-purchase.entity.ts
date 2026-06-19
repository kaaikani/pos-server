import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity()
export class PharmaPurchase extends VendureEntity {
    constructor(input?: DeepPartial<PharmaPurchase>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) purNo!: string;
    @Column({ type: 'varchar' }) purDate!: string;
    @Column({ type: 'varchar', default: '' }) invNo!: string;
    @Column({ type: 'varchar', default: '' }) invDate!: string;
    @Column({ type: 'varchar', default: 'Exclusive' }) taxMode!: string;
    @Column({ type: 'varchar', default: 'Cash' }) payType!: string;
    @Column({ type: 'boolean', default: false }) otherState!: boolean;
    @Column({ type: 'varchar', default: '' }) supplier!: string;
    @Column({ type: 'varchar', default: '' }) orderRef!: string;
    @Column({ type: 'varchar', default: '' }) transMode!: string;
    @Column({ type: 'varchar', default: '' }) address!: string;
    @Column({ type: 'varchar', default: '' }) transportName!: string;
    @Column({ type: 'text', nullable: true }) rowsJson!: string | null;
    @Column({ type: 'float', default: 0 }) totalAmount!: number;
    @Column({ type: 'float', default: 0 }) totalDiscA!: number;
    @Column({ type: 'float', default: 0 }) totalTax!: number;
    @Column({ type: 'float', default: 0 }) roundOff!: number;
    @Column({ type: 'float', default: 0 }) netAmount!: number;
    @Column({ type: 'varchar', default: '' }) supplierPhone!: string;
    @Column({ type: 'varchar', default: '' }) stateOfSupply!: string;

    // ───── GST compliance (Step 4) ─────
    @Column({ type: 'varchar', default: '' }) supplierGstin!: string;
    /** 2-digit place-of-supply state code (drives intra/inter-state). */
    @Column({ type: 'varchar', default: '' }) placeOfSupply!: string;
    /** Whether the input tax on this purchase can be claimed as ITC. */
    @Column({ type: 'boolean', default: true }) itcEligible!: boolean;
    @Column({ type: 'boolean', default: false }) reverseCharge!: boolean;
    @Column({ type: 'text', nullable: true }) remarks!: string | null;
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
    @Column({ type: 'integer', nullable: true }) updatedByAdminId!: number | null;

    // Soft-delete fields (Phase 0)
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: 'ACTIVE' | 'CANCELLED';
    @Column({ type: 'datetime', nullable: true }) cancelledAt!: Date | null;
    @Column({ type: 'integer', nullable: true }) cancelledByAdminId!: number | null;
    @Column({ type: 'varchar', default: '' }) cancelReason!: string;
}
