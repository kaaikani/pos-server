import { Inject, Injectable } from '@nestjs/common';
import { EventBus, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { PosPurchaseCreatedEvent } from '../../pharma/events/pos-purchase-created.event';
import { PosSaleCreatedEvent } from '../../pharma/events/pos-sale-created.event';
import { Ledger, LedgerStatus, LedgerType } from '../entities/ledger.entity';
import { LedgerPayment, PaymentMode } from '../entities/ledger-payment.entity';

const MAX_LIST = 10000;
const LOG_CTX = 'LedgerService';

export interface CreateLedgerInput {
    type: LedgerType;
    partyName: string;
    invoiceNumber: string;
    invoiceDate: Date | string;
    amount: number;
    paidAmount?: number;
    creditDays: number;
    contactNumber?: string;
    gstNumber?: string;
    address?: string;
}

export interface PaymentInput {
    amount: number;
    paymentMode: PaymentMode;
    paymentDate: Date | string;
}

export interface LedgerSummary {
    totalSales: number;
    totalPurchase: number;
    totalReceivable: number;
    totalPayable: number;
}

@Injectable()
export class LedgerService {
    constructor(
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
        @Inject(EventBus) eventBus: EventBus,
    ) {
        Logger.info('Subscribing to PosSale/PosPurchase events', LOG_CTX);

        eventBus.ofType(PosSaleCreatedEvent).subscribe(async ({ ctx, sale }) => {
            Logger.info(`PosSaleCreatedEvent received: billNo=${sale.billNo} saleType=${sale.saleType} grandTotal=${sale.grandTotal} receivedAmount=${sale.receivedAmount} balanceDue=${sale.balanceDue}`, LOG_CTX);
            const grandTotal = Number(sale.grandTotal) || 0;
            const received = Number(sale.receivedAmount) || 0;
            const balanceDue = Number(sale.balanceDue) || (grandTotal - received);
            const isCredit = String(sale.saleType).toUpperCase() === 'CREDIT';
            const hasBalance = balanceDue > 0;

            if (!isCredit && !hasBalance) {
                Logger.info(`Skip ledger for sale ${sale.billNo}: not credit and balanceDue=${balanceDue}`, LOG_CTX);
                return;
            }

            try {
                const created = await this.createLedger(ctx, {
                    type: 'CUSTOMER',
                    partyName: sale.customerName || 'Walk-in',
                    invoiceNumber: sale.billNo,
                    invoiceDate: this.parseBillDate(sale.billDate),
                    amount: Math.round(grandTotal),
                    paidAmount: Math.round(received),
                    creditDays: 0,
                    contactNumber: sale.customerPhone || '',
                    gstNumber: '',
                    address: sale.customerAddress || '',
                });
                Logger.info(`Customer Ledger created id=${created.id} from sale ${sale.billNo}`, LOG_CTX);
            } catch (err: any) {
                Logger.error(
                    `Auto-ledger from sale ${sale.billNo} failed: ${err?.message ?? err}`,
                    LOG_CTX,
                );
            }
        });

        eventBus.ofType(PosPurchaseCreatedEvent).subscribe(async ({ ctx, purchase }) => {
            Logger.info(`PosPurchaseCreatedEvent received: purNo=${purchase.purNo} invNo=${purchase.invNo} payType=${purchase.payType} netAmount=${purchase.netAmount}`, LOG_CTX);
            if (String(purchase.payType).toUpperCase() !== 'CREDIT') {
                Logger.info(`Skip ledger for purchase ${purchase.invNo || purchase.purNo}: payType=${purchase.payType}`, LOG_CTX);
                return;
            }
            try {
                const created = await this.createLedger(ctx, {
                    type: 'SUPPLIER',
                    partyName: purchase.supplier,
                    invoiceNumber: purchase.invNo || purchase.purNo,
                    invoiceDate: this.parseBillDate(purchase.invDate || purchase.purDate),
                    amount: Math.round(Number(purchase.netAmount) || 0),
                    paidAmount: 0,
                    creditDays: 0,
                    contactNumber: '',
                    gstNumber: '',
                    address: purchase.address || '',
                });
                Logger.info(`Supplier Ledger created id=${created.id} from purchase ${purchase.invNo || purchase.purNo}`, LOG_CTX);
            } catch (err: any) {
                Logger.error(
                    `Auto-ledger from purchase ${purchase.invNo || purchase.purNo} failed: ${err?.message ?? err}`,
                    LOG_CTX,
                );
            }
        });
    }

    async createLedger(ctx: RequestContext, input: CreateLedgerInput): Promise<Ledger> {
        // Uniqueness key: type + contactNumber + invoiceNumber.
        if (input.contactNumber && input.invoiceNumber) {
            const existing = await this.connection.getRepository(ctx, Ledger).findOne({
                where: {
                    contactNumber: input.contactNumber,
                    invoiceNumber: input.invoiceNumber,
                    type: input.type,
                },
            });
            if (existing) {
                throw new Error(
                    `Invoice "${input.invoiceNumber}" already exists for this ${String(input.type).toLowerCase()} (Ledger ID: ${existing.id}). Use a different invoice number.`,
                );
            }
        }

        const amount = Math.round(Number(input.amount) || 0);
        const paidAmount = Math.max(0, Math.round(Number(input.paidAmount) || 0));
        const balance = amount - paidAmount;
        const status: LedgerStatus =
            balance <= 0 ? 'FULLY_PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';

        const invoiceDate =
            input.invoiceDate instanceof Date ? input.invoiceDate : new Date(input.invoiceDate);

        const ledger = new Ledger({
            type: input.type,
            partyName: input.partyName,
            invoiceNumber: input.invoiceNumber,
            invoiceDate,
            amount,
            paidAmount,
            balance,
            status,
            creditDays: Number(input.creditDays) || 0,
            contactNumber: input.contactNumber || '',
            gstNumber: input.gstNumber || '',
            address: input.address || '',
        });
        return this.connection.getRepository(ctx, Ledger).save(ledger);
    }

    async findAll(ctx: RequestContext, type: LedgerType): Promise<Ledger[]> {
        return this.connection.getRepository(ctx, Ledger).find({
            where: { type },
            relations: ['payments'],
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async findOne(ctx: RequestContext, id: string | number): Promise<Ledger | null> {
        return this.connection.getRepository(ctx, Ledger).findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            relations: ['payments'],
        });
    }

    async getSummary(ctx: RequestContext): Promise<LedgerSummary> {
        const ledgers = await this.connection.getRepository(ctx, Ledger).find({ take: MAX_LIST });
        const summary: LedgerSummary = {
            totalSales: 0,
            totalPurchase: 0,
            totalReceivable: 0,
            totalPayable: 0,
        };

        for (const l of ledgers) {
            if (l.type === 'CUSTOMER') {
                summary.totalSales += l.amount;
                summary.totalReceivable += l.balance;
            } else {
                summary.totalPurchase += l.amount;
                summary.totalPayable += l.balance;
            }
        }
        return summary;
    }

    async deleteLedger(ctx: RequestContext, id: string | number): Promise<boolean> {
        const ledger = await this.connection.getEntityOrThrow(
            ctx,
            Ledger,
            typeof id === 'string' ? parseInt(id, 10) : id,
            { relations: ['payments'] },
        );
        if (ledger.payments.length > 0) {
            await this.connection.getRepository(ctx, LedgerPayment).remove(ledger.payments);
        }
        await this.connection.getRepository(ctx, Ledger).remove(ledger);
        return true;
    }

    async addPayment(
        ctx: RequestContext,
        ledgerId: string | number,
        input: PaymentInput,
    ): Promise<Ledger> {
        const idNum = typeof ledgerId === 'string' ? parseInt(ledgerId, 10) : ledgerId;
        const amount = Number(input.amount) || 0;
        const paymentDate =
            input.paymentDate instanceof Date ? input.paymentDate : new Date(input.paymentDate);

        return this.connection.withTransaction(ctx, async tCtx => {
            const ledgerRepo = this.connection.getRepository(tCtx, Ledger);

            // C3 — pessimistic lock prevents lost-update under concurrent payments.
            const ledger = await ledgerRepo
                .createQueryBuilder('l')
                .setLock('pessimistic_write')
                .where('l.id = :id', { id: idNum })
                .getOne();
            if (!ledger) throw new Error(`Ledger with id ${idNum} not found.`);

            // LedgerPayment links to its Ledger via the `ledger` relation (FK column
            // `ledgerId`). Setting the relation object here persists ledgerId correctly on
            // this TypeORM/Vendure version — verified 2026-06-09 (payment history loads via
            // the ledgerId JOIN). The earlier "persists NULL" note (C7) did not reproduce.
            const paymentRepo = this.connection.getRepository(tCtx, LedgerPayment);
            const payment = paymentRepo.create({
                amount,
                paymentMode: input.paymentMode,
                paymentDate,
                ledger,
            });
            await paymentRepo.save(payment);

            ledger.paidAmount = Number(ledger.paidAmount) + amount;
            ledger.balance = Number(ledger.amount) - ledger.paidAmount;

            if (ledger.balance <= 0) {
                ledger.status = 'FULLY_PAID';
            } else if (ledger.paidAmount > 0) {
                ledger.status = 'PARTIALLY_PAID';
            } else {
                ledger.status = 'PENDING';
            }

            await ledgerRepo.save(ledger);

            return this.connection.getEntityOrThrow(tCtx, Ledger, idNum, {
                relations: ['payments'],
            });
        });
    }

    private parseBillDate(raw: unknown): Date {
        if (!raw) return new Date();
        if (raw instanceof Date) return raw;
        const s = String(raw).trim();
        if (!s) return new Date();

        // dd/mm/yyyy or dd-mm-yyyy
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
            const [, d, m, y] = dmy;
            const dt = new Date(Number(y), Number(m) - 1, Number(d));
            if (!isNaN(dt.getTime())) return dt;
        }

        // yyyy-mm-dd or ISO
        const iso = new Date(s);
        if (!isNaN(iso.getTime())) return iso;

        Logger.warn(`parseBillDate could not parse "${s}", falling back to now`, LOG_CTX);
        return new Date();
    }
}
