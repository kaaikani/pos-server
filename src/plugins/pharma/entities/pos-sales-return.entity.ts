import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Customer-facing sales return. Stock INCREASES (mirror of PosPurchaseReturn
 * which decreases). The original PharmaSale is NEVER mutated; financial
 * impact is posted via a negative PharmaReceipt linked back here.
 *
 * Rate per row is forced to the ORIGINAL sales rate from the invoice; client-
 * supplied rates are overridden in createSalesReturn().
 */
@Entity()
@Index('IDX_sales_return_originalSaleId', ['originalSaleId'])
@Index('IDX_sales_return_customerPhone', ['customerPhone'])
export class PosSalesReturn extends VendureEntity {
    constructor(input?: DeepPartial<PosSalesReturn>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) retNo!: string;
    @Column({ type: 'varchar' }) retDate!: string;
    @Column({ type: 'varchar', default: '' }) retTime!: string;

    @Column({ type: 'integer', nullable: true }) originalSaleId!: number | null;
    @Column({ type: 'varchar', default: '' }) originalBillNo!: string;

    @Column({ type: 'varchar', default: '' }) customerName!: string;
    @Column({ type: 'varchar', default: '' }) customerPhone!: string;
    @Column({ type: 'varchar', default: '' }) customerAddress!: string;

    // ───── GST compliance (Step 4) — credit note (CDNR) fields ─────
    @Column({ type: 'varchar', default: '' }) customerGstin!: string;
    @Column({ type: 'varchar', default: '' }) placeOfSupply!: string;

    @Column({ type: 'text', nullable: true }) rowsJson!: string | null;

    @Column({ type: 'float', default: 0 }) totalAmount!: number;
    @Column({ type: 'float', default: 0 }) totalTax!: number;
    @Column({ type: 'float', default: 0 }) totalDisc!: number;
    @Column({ type: 'float', default: 0 }) netAmount!: number;

    @Column({ type: 'varchar', default: '' }) reason!: string;
    @Column({ type: 'varchar', default: '' }) remarks!: string;

    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: 'ACTIVE' | 'CANCELLED';

    /**
     * Idempotency flag for ledger sync. true = the netAmount reduction has been
     * applied to the corresponding Ledger row. false = pending (bug-period
     * residue or CASH sale with no ledger). Toggled by createSalesReturn,
     * cancelSalesReturn, and reconcileSalesReturnsToLedger.
     */
    @Column({ type: 'boolean', default: false }) ledgerApplied!: boolean;

    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
    @Column({ type: 'integer', nullable: true }) updatedByAdminId!: number | null;
    @Column({ type: 'datetime', nullable: true }) cancelledAt!: Date | null;
    @Column({ type: 'integer', nullable: true }) cancelledByAdminId!: number | null;
    @Column({ type: 'varchar', default: '' }) cancelReason!: string;
}
