import { VendureEntity } from '@vendure/core';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ledger } from './ledger.entity';

@Entity()
export class LedgerPayment extends VendureEntity {
    constructor(input) {
        super(input);
    }

    @Column({ type: 'integer' })
    amount;

    @Column({ type: 'datetime' })
    paymentDate;

    @Column({ type: 'varchar' })
    paymentMode;

    @Column({ type: 'integer', nullable: true })
    ledgerId;

    @ManyToOne(() => Ledger, ledger => ledger.payments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ledgerId' })
    ledger;
}
