import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { DiscountType, PriceTierType, RecordStatus, TaxMode } from '../types/pos-types';

@Entity()
export class PosItemPriceTier extends VendureEntity {
    constructor(input?: DeepPartial<PosItemPriceTier>) {
        super(input);
    }

    @Column({ type: 'integer' }) itemId!: number;
    @Column({ type: 'varchar' }) tierType!: PriceTierType;
    @Column({ type: 'varchar', default: '' }) label!: string;
    @Column({ type: 'float' }) rate!: number;
    @Column({ type: 'float', default: 0 }) minQty!: number;
    @Column({ type: 'varchar', default: 'Without Tax' }) taxMode!: TaxMode;
    @Column({ type: 'float', default: 0 }) discountPct!: number;
    @Column({ type: 'float', default: 0 }) discountFlat!: number;
    @Column({ type: 'varchar', default: 'Percentage' }) discountType!: DiscountType;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
}
