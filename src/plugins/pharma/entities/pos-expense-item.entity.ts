import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { RecordStatus, TaxMode } from '../types/pos-types';

@Entity()
export class PosExpenseItem extends VendureEntity {
    constructor(input?: DeepPartial<PosExpenseItem>) {
        super(input);
    }

    @Column({ type: 'varchar' }) itemName!: string;
    @Column({ type: 'varchar', default: '' }) hsnCode!: string;
    @Column({ type: 'varchar', default: '' }) description!: string;
    @Column({ type: 'float', default: 0 }) price!: number;
    @Column({ type: 'varchar', default: 'Without Tax' }) taxMode!: TaxMode;
    @Column({ type: 'float', default: 0 }) taxPercent!: number;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
}
