import { VendureEntity } from '@vendure/core';
import { Entity, Column, OneToMany } from 'typeorm';
import { LedgerPayment } from './ledger-payment.entity';

@Entity()
export class Ledger extends VendureEntity {
    constructor(input) {
        super(input);
    }

    @Column({ type: 'varchar' })
    type;

    @Column({ type: 'varchar' })
    partyName;

    @Column({ type: 'varchar' })
    invoiceNumber;

    @Column({ type: 'datetime' })
    invoiceDate;

    @Column({ type: 'integer' })
    amount;

    @Column({ type: 'integer' })
    paidAmount;

    @Column({ type: 'integer' })
    balance;

    @Column({ type: 'varchar' })
    status;

    @Column({ type: 'integer' })
    creditDays;

    @Column({ type: 'varchar', default: '' })
    contactNumber;

    @Column({ type: 'varchar', default: '' })
    gstNumber;

    @Column({ type: 'varchar', default: '' })
    address;

    @OneToMany(() => LedgerPayment, payment => payment.ledger)
    payments;
}
