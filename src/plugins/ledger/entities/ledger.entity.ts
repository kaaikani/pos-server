import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, OneToMany } from 'typeorm';
import { LedgerPayment } from './ledger-payment.entity';

export type LedgerType = 'CUSTOMER' | 'SUPPLIER';
export type LedgerStatus = 'PENDING' | 'PARTIALLY_PAID' | 'FULLY_PAID';

@Entity()
export class Ledger extends VendureEntity {
    constructor(input?: DeepPartial<Ledger>) {
        super(input);
    }

    @Column({ type: 'varchar' })
    type!: LedgerType;

    @Column({ type: 'varchar' })
    partyName!: string;

    @Column({ type: 'varchar' })
    invoiceNumber!: string;

    @Column({ type: 'datetime' })
    invoiceDate!: Date;

    @Column({ type: 'integer' })
    amount!: number;

    @Column({ type: 'integer' })
    paidAmount!: number;

    @Column({ type: 'integer' })
    balance!: number;

    @Column({ type: 'varchar' })
    status!: LedgerStatus;

    @Column({ type: 'integer' })
    creditDays!: number;

    @Column({ type: 'varchar', default: '' })
    contactNumber!: string;

    @Column({ type: 'varchar', default: '' })
    gstNumber!: string;

    @Column({ type: 'varchar', default: '' })
    address!: string;

    @OneToMany(() => LedgerPayment, payment => payment.ledger)
    payments!: LedgerPayment[];
}
