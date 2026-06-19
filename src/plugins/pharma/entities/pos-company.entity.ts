import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { RecordStatus } from '../types/pos-types';

/**
 * Seller (the shop's own) company / GST identity. Replaces the old
 * frontend-localStorage-only company settings so that seller GSTIN, state and
 * address are stored server-side and can drive:
 *   - intra/inter-state (CGST+SGST vs IGST) decision via stateCode
 *   - seller GSTIN/address on invoices and GST returns
 *
 * Exactly one row should be `isActive=true` at a time (enforced in the service).
 * `channelId` is reserved for future per-shop (multi-tenant) support and is null
 * for the current single-tenant setup.
 */
@Entity()
export class PosCompany extends VendureEntity {
    constructor(input?: DeepPartial<PosCompany>) {
        super(input);
    }

    @Column({ type: 'varchar' }) companyName!: string;
    @Column({ type: 'varchar', default: '' }) legalName!: string;
    /** 15-char GSTIN of the seller. Empty allowed at creation, required for filing. */
    @Column({ type: 'varchar', default: '' }) gstin!: string;
    @Column({ type: 'varchar', default: '' }) phone!: string;
    @Column({ type: 'varchar', default: '' }) email!: string;
    @Column({ type: 'varchar', default: '' }) address!: string;
    @Column({ type: 'varchar', default: '' }) pincode!: string;
    @Column({ type: 'varchar', default: '' }) stateName!: string;
    /** 2-digit GST state code (e.g. 33 = Tamil Nadu). Drives place-of-supply logic. */
    @Column({ type: 'varchar', default: '' }) stateCode!: string;
    @Column({ type: 'varchar', default: '' }) financialYear!: string;

    /** Exactly one active company surfaces as the filing identity / invoice header. */
    @Column({ type: 'boolean', default: false }) isActive!: boolean;

    /** Future multi-shop scoping. Null = single-tenant (current). */
    @Column({ type: 'integer', nullable: true }) channelId!: number | null;

    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
    @Column({ type: 'integer', nullable: true }) updatedByAdminId!: number | null;
}
