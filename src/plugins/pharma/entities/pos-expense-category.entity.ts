import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { RecordStatus } from '../types/pos-types';

@Entity()
export class PosExpenseCategory extends VendureEntity {
    constructor(input?: DeepPartial<PosExpenseCategory>) {
        super(input);
    }

    @Column({ type: 'varchar' }) name!: string;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
}
