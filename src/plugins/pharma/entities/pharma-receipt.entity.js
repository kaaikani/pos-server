import { VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class PharmaReceipt extends VendureEntity {
    constructor(input) { super(input); }
    @Column({ type: 'varchar' }) docNo;
    @Column({ type: 'varchar' }) docDate;
    @Column({ type: 'varchar', default: '' }) billRefNo;
    @Column({ type: 'varchar', default: 'Against Ref.' }) docType;
    @Column({ type: 'varchar', default: 'Manual' }) refType;
    @Column({ type: 'varchar' }) accHead;
    @Column({ type: 'varchar', default: 'Cash' }) payMode;
    @Column({ type: 'varchar', default: '' }) narration1;
    @Column({ type: 'varchar', default: '' }) narration2;
    @Column({ type: 'float', default: 0 }) cashDisc;
    @Column({ type: 'float', default: 0 }) amount;
    @Column({ type: 'float', default: 0 }) recAmount;
    @Column({ type: 'text', default: '[]' }) rowsJson;
}
