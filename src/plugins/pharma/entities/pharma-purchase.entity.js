import { VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class PharmaPurchase extends VendureEntity {
    constructor(input) { super(input); }
    @Column({ type: 'varchar' }) purNo;
    @Column({ type: 'varchar' }) purDate;
    @Column({ type: 'varchar', default: '' }) invNo;
    @Column({ type: 'varchar', default: '' }) invDate;
    @Column({ type: 'varchar', default: 'Exclusive' }) taxMode;
    @Column({ type: 'varchar', default: 'Cash' }) payType;
    @Column({ type: 'boolean', default: false }) otherState;
    @Column({ type: 'varchar' }) supplier;
    @Column({ type: 'varchar', default: '' }) orderRef;
    @Column({ type: 'varchar', default: '' }) transMode;
    @Column({ type: 'varchar', default: '' }) address;
    @Column({ type: 'varchar', default: '' }) transportName;
    @Column({ type: 'text', default: '[]' }) rowsJson; // JSON array of line items
    @Column({ type: 'float', default: 0 }) totalAmount;
    @Column({ type: 'float', default: 0 }) totalDiscA;
    @Column({ type: 'float', default: 0 }) totalTax;
    @Column({ type: 'float', default: 0 }) netAmount;
}
