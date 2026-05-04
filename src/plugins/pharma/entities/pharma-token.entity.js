import { VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class PharmaToken extends VendureEntity {
    constructor(input) { super(input); }
    @Column({ type: 'integer' }) tokenNo;
    @Column({ type: 'varchar' }) tokenDate;
    @Column({ type: 'varchar', default: '' }) tokenTime;
    @Column({ type: 'varchar' }) patientName;
    @Column({ type: 'varchar', default: '' }) address;
    @Column({ type: 'varchar', default: '' }) cellNo;
    @Column({ type: 'float', default: 0 }) amount;
    @Column({ type: 'float', default: 0 }) injAmt;
    @Column({ type: 'float', default: 0 }) total;
}
