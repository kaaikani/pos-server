import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity()
export class PharmaPayment extends VendureEntity {
    constructor(input?: DeepPartial<PharmaPayment>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) payNo!: string;
    @Column({ type: 'varchar' }) payDate!: string;
    @Column({ type: 'varchar', default: '' }) refNo!: string;
    @Column({ type: 'varchar', default: 'Cash' }) payType!: string;
    @Column({ type: 'boolean', default: false }) otherState!: boolean;
    @Column({ type: 'varchar' }) supplierName!: string;
    @Column({ type: 'varchar', default: '' }) supplierGST!: string;
    @Column({ type: 'varchar', default: '' }) orderRef!: string;
    @Column({ type: 'varchar', default: '' }) transMode!: string;
    @Column({ type: 'varchar', default: '' }) address!: string;
    @Column({ type: 'varchar', default: '' }) chequeNo!: string;
    @Column({ type: 'varchar', default: '' }) bankName!: string;
    @Column({ type: 'varchar', default: '' }) narration!: string;
    @Column({ type: 'text', nullable: true }) rowsJson!: string | null;
    @Column({ type: 'float', default: 0 }) totalPaying!: number;
    @Column({ type: 'float', default: 0 }) totalDisc!: number;
    @Column({ type: 'float', default: 0 }) totalNet!: number;
}
