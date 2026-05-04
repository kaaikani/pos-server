import { Inject, Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { Ledger } from '../entities/ledger.entity';
import { LedgerPayment } from '../entities/ledger-payment.entity';

@Injectable()
export class LedgerService {
    constructor(@Inject(TransactionalConnection) connection) {
        this.connection = connection;
    }

    async createLedger(ctx, input) {
        // Uniqueness key: type + contactNumber + invoiceNumber.
        // Same supplier (same contact) CAN have many invoices — only exact invoice-number repeats are blocked.
        if (input.contactNumber && input.invoiceNumber) {
            const existing = await this.connection.getRepository(ctx, Ledger).findOne({
                where: {
                    contactNumber: input.contactNumber,
                    invoiceNumber: input.invoiceNumber,
                    type: input.type,
                }
            });
            if (existing) {
                throw new Error(`Invoice "${input.invoiceNumber}" already exists for this ${String(input.type || '').toLowerCase()} (Ledger ID: ${existing.id}). Use a different invoice number.`);
            }
        }

        const ledger = new Ledger({
            ...input,
            contactNumber: input.contactNumber || '',
            gstNumber: input.gstNumber || '',
            address: input.address || '',
            paidAmount: 0,
            balance: input.amount,
            status: 'PENDING'
        });
        return this.connection.getRepository(ctx, Ledger).save(ledger);
    }

    async findAll(ctx, type) {
        return this.connection.getRepository(ctx, Ledger).find({
            where: { type },
            relations: ['payments']
        });
    }

    async findOne(ctx, id) {
        return this.connection.getRepository(ctx, Ledger).findOne({
            where: { id },
            relations: ['payments']
        });
    }

    async getSummary(ctx) {
        const ledgers = await this.connection.getRepository(ctx, Ledger).find();
        let summary = { 
            totalSales: 0, 
            totalPurchase: 0, 
            totalReceivable: 0, 
            totalPayable: 0 
        };

        ledgers.forEach(l => {
            if (l.type === 'CUSTOMER') {
                summary.totalSales += l.amount;
                summary.totalReceivable += l.balance;
            } else {
                summary.totalPurchase += l.amount;
                summary.totalPayable += l.balance;
            }
        });

        return summary;
    }

    async deleteLedger(ctx, id) {
        const ledger = await this.connection.getEntityOrThrow(ctx, Ledger, id, {
            relations: ['payments']
        });
        if (ledger.payments.length > 0) {
            await this.connection.getRepository(ctx, LedgerPayment).remove(ledger.payments);
        }
        await this.connection.getRepository(ctx, Ledger).remove(ledger);
        return true;
    }

    async addPayment(ctx, ledgerId, input) {
        const ledger = await this.connection.getEntityOrThrow(ctx, Ledger, ledgerId, { 
            relations: ['payments'] 
        });

        // Save payment via ORM
        const paymentRepo = this.connection.getRepository(ctx, LedgerPayment);
        const payment = new LedgerPayment();
        payment.amount = input.amount;
        payment.paymentMode = input.paymentMode;
        payment.paymentDate = input.paymentDate;
        payment.ledger = ledger;
        const saved = await paymentRepo.save(payment);

        // Fix ledgerId AFTER transaction commits via setTimeout
        const savedId = Number(saved.id);
        const lid = Number(ledger.id);
        setTimeout(() => {
            try {
                const path = require('path');
                const Database = require('better-sqlite3');
                const dbPath = path.join(__dirname, '..', '..', '..', '..', 'vendure.sqlite');
                const db = new Database(dbPath);
                db.prepare('UPDATE ledger_payment SET ledgerId = ? WHERE id = ?').run(lid, savedId);
                db.close();
            } catch (e) {
                console.error('[LEDGER] setTimeout fix failed:', e);
            }
        }, 500);

        ledger.paidAmount += input.amount;
        ledger.balance = ledger.amount - ledger.paidAmount;

        if (ledger.balance <= 0) {
            ledger.status = 'FULLY_PAID';
        } else if (ledger.paidAmount > 0) {
            ledger.status = 'PARTIALLY_PAID';
        } else {
            ledger.status = 'PENDING';
        }

        await this.connection.getRepository(ctx, Ledger).save(ledger);

        return this.connection.getEntityOrThrow(ctx, Ledger, ledgerId, {
            relations: ['payments']
        });
    }
}
