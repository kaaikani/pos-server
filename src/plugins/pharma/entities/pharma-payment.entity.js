import { VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class PharmaPayment extends VendureEntity {
    constructor(input) { super(input); }
    @Column({ type: 'varchar' }) payNo;
    @Column({ type: 'varchar' }) payDate;
    @Column({ type: 'varchar', default: '' }) refNo;
    @Column({ type: 'varchar', default: 'Cash' }) payType;
    @Column({ type: 'boolean', default: false }) otherState;
    @Column({ type: 'varchar' }) supplierName;
    @Column({ type: 'varchar', default: '' }) supplierGST;
    @Column({ type: 'varchar', default: '' }) orderRef;
    @Column({ type: 'varchar', default: '' }) transMode;
    @Column({ type: 'varchar', default: '' }) address;
    @Column({ type: 'varchar', default: '' }) chequeNo;
    @Column({ type: 'varchar', default: '' }) bankName;
    @Column({ type: 'varchar', default: '' }) narration;
    @Column({ type: 'text', default: '[]' }) rowsJson;
    @Column({ type: 'float', default: 0 }) totalPaying;
    @Column({ type: 'float', default: 0 }) totalDisc;
    @Column({ type: 'float', default: 0 }) totalNet;
}
