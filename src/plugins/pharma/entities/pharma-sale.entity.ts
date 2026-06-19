import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity()
export class PharmaSale extends VendureEntity {
    constructor(input?: DeepPartial<PharmaSale>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) billNo!: string;
    @Column({ type: 'varchar' }) billDate!: string;
    @Column({ type: 'varchar', default: '' }) billTime!: string;
    @Column({ type: 'varchar', default: 'CASH' }) saleType!: string;
    @Column({ type: 'varchar', default: '' }) bookNo!: string;
    @Column({ type: 'varchar', default: '' }) billRef!: string;
    @Column({ type: 'varchar', default: 'Walk-in' }) customerName!: string;
    @Column({ type: 'varchar', default: '' }) customerPhone!: string;
    @Column({ type: 'varchar', default: '' }) customerAddress!: string;
    @Column({ type: 'varchar', default: '' }) salesMan!: string;

    // ───── GST compliance (Step 4) ─────
    /** Customer GSTIN (present => B2B invoice). */
    @Column({ type: 'varchar', default: '' }) customerGstin!: string;
    /** 2-digit place-of-supply state code (drives intra/inter-state). */
    @Column({ type: 'varchar', default: '' }) placeOfSupply!: string;
    /** Auto-derived: 'B2B' when customerGstin present, else 'B2C'. */
    @Column({ type: 'varchar', default: 'B2C' }) invoiceType!: string;
    @Column({ type: 'boolean', default: false }) reverseCharge!: boolean;

    @Column({ type: 'text', nullable: true }) itemsJson!: string | null;
    @Column({ type: 'float', default: 0 }) subtotal!: number;
    @Column({ type: 'float', default: 0 }) taxAmount!: number;
    @Column({ type: 'float', default: 0 }) discount!: number;
    @Column({ type: 'float', default: 0 }) transportCharges!: number;
    @Column({ type: 'float', default: 0 }) roundOff!: number;
    @Column({ type: 'float', default: 0 }) grandTotal!: number;
    @Column({ type: 'float', default: 0 }) cashAmount!: number;
    @Column({ type: 'float', default: 0 }) upiAmount!: number;
    @Column({ type: 'float', default: 0 }) cardAmount!: number;
    @Column({ type: 'float', default: 0 }) chequeAmount!: number;
    @Column({ type: 'float', default: 0 }) onlineAmount!: number;
    @Column({ type: 'float', default: 0 }) receivedAmount!: number;
    @Column({ type: 'float', default: 0 }) balanceDue!: number;
    @Column({ type: 'float', default: 0 }) changeReturned!: number;
    @Column({ type: 'varchar', default: '' }) remarks!: string;

    // Audit fields (Phase 0)
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
    @Column({ type: 'integer', nullable: true }) updatedByAdminId!: number | null;

    // Soft-delete fields (Phase 0)
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: 'ACTIVE' | 'CANCELLED';
    @Column({ type: 'datetime', nullable: true }) cancelledAt!: Date | null;
    @Column({ type: 'integer', nullable: true }) cancelledByAdminId!: number | null;
    @Column({ type: 'varchar', default: '' }) cancelReason!: string;
}
