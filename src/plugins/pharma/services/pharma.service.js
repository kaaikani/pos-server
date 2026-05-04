import { Inject, Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { PharmaItem } from '../entities/pharma-item.entity';
import { PharmaPurchase } from '../entities/pharma-purchase.entity';
import { PharmaPayment } from '../entities/pharma-payment.entity';
import { PharmaReceipt } from '../entities/pharma-receipt.entity';
import { PharmaToken } from '../entities/pharma-token.entity';
import { PharmaSale } from '../entities/pharma-sale.entity';

@Injectable()
export class PharmaService {
    constructor(@Inject(TransactionalConnection) connection) {
        this.connection = connection;
    }

    // ── ITEMS ──
    async listItems(ctx) {
        return this.connection.getRepository(ctx, PharmaItem).find({ order: { createdAt: 'DESC' } });
    }
    async getItem(ctx, id) {
        return this.connection.getRepository(ctx, PharmaItem).findOne({ where: { id: parseInt(id) } });
    }
    async createItem(ctx, input) {
        const repo = this.connection.getRepository(ctx, PharmaItem);
        const existing = await repo.findOne({ where: { code: input.code } });
        if (existing) throw new Error(`Item code "${input.code}" already exists.`);
        const item = new PharmaItem({
            ...input,
            sizesJson: input.sizes ? JSON.stringify(input.sizes) : '[]',
        });
        return repo.save(item);
    }
    async updateItem(ctx, id, input) {
        const repo = this.connection.getRepository(ctx, PharmaItem);
        const item = await repo.findOne({ where: { id: parseInt(id) } });
        if (!item) throw new Error('Item not found.');
        Object.assign(item, input);
        if (input.sizes !== undefined) item.sizesJson = JSON.stringify(input.sizes);
        return repo.save(item);
    }
    async deleteItem(ctx, id) {
        const repo = this.connection.getRepository(ctx, PharmaItem);
        const item = await repo.findOne({ where: { id: parseInt(id) } });
        if (!item) throw new Error('Item not found.');
        await repo.remove(item);
        return true;
    }

    // ── PURCHASES ──
    async listPurchases(ctx) {
        return this.connection.getRepository(ctx, PharmaPurchase).find({ order: { createdAt: 'DESC' } });
    }
    async createPurchase(ctx, input) {
        const repo = this.connection.getRepository(ctx, PharmaPurchase);
        const p = new PharmaPurchase({ ...input, rowsJson: JSON.stringify(input.rows || []) });
        return repo.save(p);
    }
    async deletePurchase(ctx, id) {
        const repo = this.connection.getRepository(ctx, PharmaPurchase);
        const p = await repo.findOne({ where: { id: parseInt(id) } });
        if (!p) throw new Error('Purchase not found.');
        await repo.remove(p);
        return true;
    }

    // ── PAYMENTS ──
    async listPayments(ctx) {
        return this.connection.getRepository(ctx, PharmaPayment).find({ order: { createdAt: 'DESC' } });
    }
    async createPayment(ctx, input) {
        const repo = this.connection.getRepository(ctx, PharmaPayment);
        const p = new PharmaPayment({ ...input, rowsJson: JSON.stringify(input.rows || []) });
        return repo.save(p);
    }
    async deletePayment(ctx, id) {
        const repo = this.connection.getRepository(ctx, PharmaPayment);
        const p = await repo.findOne({ where: { id: parseInt(id) } });
        if (!p) throw new Error('Payment not found.');
        await repo.remove(p);
        return true;
    }

    // ── RECEIPTS ──
    async listReceipts(ctx) {
        return this.connection.getRepository(ctx, PharmaReceipt).find({ order: { createdAt: 'DESC' } });
    }
    async createReceipt(ctx, input) {
        const repo = this.connection.getRepository(ctx, PharmaReceipt);
        const r = new PharmaReceipt({ ...input, rowsJson: JSON.stringify(input.rows || []) });
        return repo.save(r);
    }
    async deleteReceipt(ctx, id) {
        const repo = this.connection.getRepository(ctx, PharmaReceipt);
        const r = await repo.findOne({ where: { id: parseInt(id) } });
        if (!r) throw new Error('Receipt not found.');
        await repo.remove(r);
        return true;
    }

    // ── TOKENS ──
    async listTokens(ctx, date) {
        const repo = this.connection.getRepository(ctx, PharmaToken);
        if (date) return repo.find({ where: { tokenDate: date }, order: { tokenNo: 'ASC' } });
        return repo.find({ order: { createdAt: 'DESC' } });
    }
    async createToken(ctx, input) {
        const repo = this.connection.getRepository(ctx, PharmaToken);
        const t = new PharmaToken(input);
        return repo.save(t);
    }
    async deleteToken(ctx, id) {
        const repo = this.connection.getRepository(ctx, PharmaToken);
        const t = await repo.findOne({ where: { id: parseInt(id) } });
        if (!t) throw new Error('Token not found.');
        await repo.remove(t);
        return true;
    }

    // ── SALES ──
    async listSales(ctx, fromDate, toDate) {
        const repo = this.connection.getRepository(ctx, PharmaSale);
        const where = {};
        if (fromDate && toDate) {
            // Simple SQLite-compatible filter via raw query if needed
            const all = await repo.find({ order: { createdAt: 'DESC' } });
            return all.filter(s => s.billDate >= fromDate && s.billDate <= toDate);
        }
        return repo.find({ order: { createdAt: 'DESC' }, take: 500 });
    }

    async getSale(ctx, id) {
        return this.connection.getRepository(ctx, PharmaSale).findOne({ where: { id: parseInt(id) } });
    }

    async createSale(ctx, input) {
        const repo = this.connection.getRepository(ctx, PharmaSale);
        const sale = new PharmaSale({ ...input, itemsJson: JSON.stringify(input.items || []) });
        return repo.save(sale);
    }

    async deleteSale(ctx, id) {
        const repo = this.connection.getRepository(ctx, PharmaSale);
        const s = await repo.findOne({ where: { id: parseInt(id) } });
        if (!s) throw new Error('Sale not found.');
        await repo.remove(s);
        return true;
    }
}
