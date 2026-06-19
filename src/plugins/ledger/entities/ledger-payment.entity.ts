import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Ledger } from './ledger.entity';

export type PaymentMode = 'CASH' | 'BANK' | 'UPI' | 'CREDIT';

@Entity()
export class LedgerPayment extends VendureEntity {
    constructor(input?: DeepPartial<LedgerPayment>) {
        super(input);
    }

    @Column({ type: 'integer' })
    amount!: number;

    @Column({ type: 'datetime' })
    paymentDate!: Date;

    @Column({ type: 'varchar' })
    paymentMode!: PaymentMode;

    @Column({ type: 'integer', nullable: true })
    ledgerId!: number | null;

    @ManyToOne(() => Ledger, ledger => ledger.payments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ledgerId' })
    ledger!: Ledger;
}
