import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity()
export class PharmaToken extends VendureEntity {
    constructor(input?: DeepPartial<PharmaToken>) {
        super(input);
    }

    @Column({ type: 'integer' }) tokenNo!: number;
    @Column({ type: 'varchar' }) tokenDate!: string;
    @Column({ type: 'varchar', default: '' }) tokenTime!: string;
    @Column({ type: 'varchar' }) patientName!: string;
    @Column({ type: 'varchar', default: '' }) address!: string;
    @Column({ type: 'varchar', default: '' }) cellNo!: string;
    @Column({ type: 'float', default: 0 }) amount!: number;
    @Column({ type: 'float', default: 0 }) injAmt!: number;
    @Column({ type: 'float', default: 0 }) total!: number;
}
