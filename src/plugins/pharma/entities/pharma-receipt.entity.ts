import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity()
export class PharmaReceipt extends VendureEntity {
    constructor(input?: DeepPartial<PharmaReceipt>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true }) docNo!: string;
    @Column({ type: 'varchar' }) docDate!: string;
    @Column({ type: 'varchar', default: '' }) billRefNo!: string;
    @Column({ type: 'varchar', default: 'Against Ref.' }) docType!: string;
    @Column({ type: 'varchar', default: 'Manual' }) refType!: string;
    @Column({ type: 'varchar' }) accHead!: string;
    @Column({ type: 'varchar', default: 'Cash' }) payMode!: string;
    @Column({ type: 'varchar', default: '' }) narration1!: string;
    @Column({ type: 'varchar', default: '' }) narration2!: string;
    @Column({ type: 'float', default: 0 }) cashDisc!: number;
    @Column({ type: 'float', default: 0 }) amount!: number;
    @Column({ type: 'float', default: 0 }) recAmount!: number;
    @Column({ type: 'text', nullable: true }) rowsJson!: string | null;
}
