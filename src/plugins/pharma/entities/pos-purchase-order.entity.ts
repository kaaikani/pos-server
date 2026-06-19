import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { PurchaseOrderStatus } from '../types/pos-types';

@Entity()
export class PosPurchaseOrder extends VendureEntity {
    constructor(input?: DeepPartial<PosPurchaseOrder>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) poNo!: string;
    @Column({ type: 'varchar' }) poDate!: string;
    @Column({ type: 'varchar', default: '' }) expectedDate!: string;
    @Column({ type: 'varchar', default: '' }) supplier!: string;
    @Column({ type: 'varchar', default: '' }) address!: string;
    @Column({ type: 'text', nullable: true }) rowsJson!: string | null;
    @Column({ type: 'varchar', default: 'OPEN' }) status!: PurchaseOrderStatus;
    @Column({ type: 'integer', nullable: true }) convertedPurchaseId!: number | null;
    @Column({ type: 'float', default: 0 }) totalAmount!: number;
    @Column({ type: 'float', default: 0 }) netAmount!: number;
    @Column({ type: 'varchar', default: '' }) remarks!: string;
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
}
