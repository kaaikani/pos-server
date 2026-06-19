import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { RecordStatus, StockAdjustmentType } from '../types/pos-types';

@Entity()
export class PosStockAdjustment extends VendureEntity {
    constructor(input?: DeepPartial<PosStockAdjustment>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) adjNo!: string;
    @Column({ type: 'varchar' }) adjDate!: string;
    @Column({ type: 'varchar' }) itemCode!: string;
    @Column({ type: 'float' }) previousQty!: number;
    @Column({ type: 'float' }) adjustQty!: number;
    @Column({ type: 'float' }) resultingQty!: number;
    @Column({ type: 'varchar' }) adjType!: StockAdjustmentType;
    @Column({ type: 'float', default: 0 }) atPrice!: number;
    @Column({ type: 'varchar', default: '' }) reason!: string;
    @Column({ type: 'varchar', default: '' }) details!: string;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
    @Column({ type: 'integer', nullable: true }) createdByAdminId!: number | null;
}
