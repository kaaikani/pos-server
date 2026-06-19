import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { RecordStatus } from '../types/pos-types';

@Entity()
export class PosUnit extends VendureEntity {
    constructor(input?: DeepPartial<PosUnit>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) code!: string;
    @Column({ type: 'varchar' }) name!: string;
    @Column({ type: 'varchar', default: '' }) symbol!: string;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: RecordStatus;
}
