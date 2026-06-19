import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EventBus, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { VendureForwardSyncService } from '../vendure-forward-sync.service';

import { Ledger } from '../../ledger/entities/ledger.entity';
import { PharmaItem } from '../entities/pharma-item.entity';
import { PharmaPayment } from '../entities/pharma-payment.entity';
import { PharmaPurchase } from '../entities/pharma-purchase.entity';
import { PharmaReceipt } from '../entities/pharma-receipt.entity';
import { PharmaSale } from '../entities/pharma-sale.entity';
import { PharmaToken } from '../entities/pharma-token.entity';
import { PosCompany } from '../entities/pos-company.entity';
import { PosExpenseCategory } from '../entities/pos-expense-category.entity';
import { PosExpenseItem } from '../entities/pos-expense-item.entity';
import { PosExpense } from '../entities/pos-expense.entity';
import { PosItemBarcode } from '../entities/pos-item-barcode.entity';
import { PosItemPriceTier } from '../entities/pos-item-price-tier.entity';
import { PosItemStockSnapshot } from '../entities/pos-item-stock-snapshot.entity';
import { PosItemUnit } from '../entities/pos-item-unit.entity';
import { PosTaxMaster } from '../entities/pos-tax-master.entity';
import { PosPurchaseOrder } from '../entities/pos-purchase-order.entity';
import { PosPurchaseReturn } from '../entities/pos-purchase-return.entity';
import { PosSalesReturn } from '../entities/pos-sales-return.entity';
import { PosSetting } from '../entities/pos-setting.entity';
import { PosStockAdjustment } from '../entities/pos-stock-adjustment.entity';
import { PosStockLedger } from '../entities/pos-stock-ledger.entity';
import { PosUnit } from '../entities/pos-unit.entity';
import { PosPurchaseCreatedEvent } from '../events/pos-purchase-created.event';
import { PosSaleCreatedEvent } from '../events/pos-sale-created.event';
import {
    DiscountType,
    PriceTierType,
    PurchaseOrderStatus,
    StockAdjustmentType,
    TaxMode,
} from '../types/pos-types';
import {
    computeLineTax,
    LineTaxResult,
    round2,
    summarizeTax,
} from '../utils/tax-calc';
import { ean13ForItemId, isValidEan13, randomEan13 } from '../utils/ean13';
import {
    buildGstr1,
    buildGstr1Csvs,
    buildGstr1PortalJson,
    buildGstr3b,
    buildGstr3bCsv,
    GstCsvFile,
    GstDoc,
    GstInwardDoc,
    GstLine,
    GstReturnCompany,
    Gstr1Report,
    Gstr3bReport,
} from '../utils/gst-returns';

const MAX_LIST = 10000;
const VALID_GST_SLABS = new Set([0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 12, 18, 28]);
// Step 2 — LOCKED set of allowed sale payment types.
const ALLOWED_SALE_PAYMENT_TYPES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'ONLINE', 'CREDIT'];
const SEED_UNITS: Array<{ code: string; name: string; symbol: string }> = [
    { code: 'NOS', name: 'Numbers', symbol: 'nos' },
    { code: 'PCS', name: 'Pieces', symbol: 'pcs' },
    { code: 'KG', name: 'Kilogram', symbol: 'kg' },
    { code: 'GM', name: 'Gram', symbol: 'g' },
    { code: 'LTR', name: 'Litre', symbol: 'L' },
    { code: 'ML', name: 'Millilitre', symbol: 'mL' },
    { code: 'BOX', name: 'Box', symbol: 'box' },
    { code: 'PKT', name: 'Packet', symbol: 'pkt' },
    { code: 'BAG', name: 'Bag', symbol: 'bag' },
    { code: 'MTR', name: 'Metre', symbol: 'm' },
];

// ───── Shared row shape used by purchase / sale / return / PO ─────
interface PurchaseRowInput {
    itemCode?: string;
    code?: string;
    itemName?: string;
    description?: string;
    count?: number | string;
    unit?: string;
    qty?: number | string;
    freeQty?: number | string;
    puRate?: number | string;
    costRate?: number | string;
    sellingRate?: number | string;
    mrpRate?: number | string;
    discountPct?: number | string;
    discountFlat?: number | string;
    taxPct?: number | string;
    amount?: number | string;
    [extra: string]: unknown;
}

interface SaleRowInput {
    code?: string;
    itemCode?: string;
    qty?: number | string;
    rate?: number | string;
    salesRate?: number | string;
    saleRate?: number | string;
    [extra: string]: unknown;
}

// ───── DTOs ─────
export interface CreatePharmaItemInput {
    code?: string;
    itemName: string;
    /** Convenience: server upserts a PosItemPriceTier(SALE) row with rate=retailRate. */
    retailRate?: number;
    /** Convenience: server upserts a PosItemPriceTier(WHOLESALE) row with rate=wholesaleRate. */
    wholesaleRate?: number;
    wholesaleMinQty?: number;
    [extra: string]: unknown;
}

export interface CreatePharmaPurchaseInput {
    purNo: string;
    purDate: string;
    invNo?: string;
    invDate?: string;
    taxMode?: string;
    payType?: string;
    otherState?: boolean;
    supplier: string;
    supplierPhone?: string;
    supplierGstin?: string;
    stateOfSupply?: string;
    /** 2-digit place-of-supply state code; drives intra/inter-state vs seller. */
    placeOfSupply?: string;
    itcEligible?: boolean;
    reverseCharge?: boolean;
    orderRef?: string;
    transMode?: string;
    address?: string;
    transportName?: string;
    rows: PurchaseRowInput[];
    totalAmount?: number;
    totalDiscA?: number;
    totalTax?: number;
    roundOff?: number;
    netAmount?: number;
    remarks?: string;
}

export interface CreatePharmaSaleInput {
    billNo: string;
    billDate: string;
    billTime?: string;
    saleType?: string;
    bookNo?: string;
    billRef?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    salesMan?: string;
    /** true → inter-state supply (IGST); false → intra-state (CGST + SGST). */
    otherState?: boolean;
    customerGstin?: string;
    /** 2-digit place-of-supply state code; drives intra/inter-state vs seller. */
    placeOfSupply?: string;
    reverseCharge?: boolean;
    roundOff?: number;
    items?: SaleRowInput[];
    subtotal?: number;
    taxAmount?: number;
    discount?: number;
    transportCharges?: number;
    grandTotal?: number;
    cashAmount?: number;
    upiAmount?: number;
    cardAmount?: number;
    chequeAmount?: number;
    onlineAmount?: number;
    receivedAmount?: number;
    balanceDue?: number;
    changeReturned?: number;
    remarks?: string;
}

export interface CreatePharmaPaymentInput {
    payNo: string;
    payDate: string;
    supplierName: string;
    rows?: unknown[];
    [extra: string]: unknown;
}

export interface CreatePharmaReceiptInput {
    docNo: string;
    docDate: string;
    accHead: string;
    rows?: unknown[];
    [extra: string]: unknown;
}

export interface CreatePharmaTokenInput {
    tokenNo: number;
    tokenDate: string;
    patientName: string;
    [extra: string]: unknown;
}

export interface CreatePosUnitInput {
    code: string;
    name: string;
    symbol?: string;
}

export interface CreatePosItemPriceTierInput {
    itemId: number;
    tierType: PriceTierType;
    label?: string;
    rate: number;
    minQty?: number;
    taxMode?: TaxMode;
    discountPct?: number;
    discountFlat?: number;
    discountType?: DiscountType;
}

export interface CreatePosStockAdjustmentInput {
    adjNo: string;
    adjDate: string;
    itemCode: string;
    adjustQty: number;
    adjType: StockAdjustmentType;
    atPrice?: number;
    reason?: string;
    details?: string;
}

export interface CreatePosPurchaseReturnInput {
    retNo: string;
    retDate: string;
    originalPurchaseId?: number | null;
    supplier?: string;
    address?: string;
    rows?: PurchaseRowInput[];
    totalAmount?: number;
    totalDisc?: number;
    totalTax?: number;
    netAmount?: number;
    reason?: string;
}

export interface CreatePosPurchaseOrderInput {
    poNo: string;
    poDate: string;
    expectedDate?: string;
    supplier?: string;
    address?: string;
    rows?: PurchaseRowInput[];
    totalAmount?: number;
    netAmount?: number;
    remarks?: string;
}

export interface CreatePosExpenseCategoryInput {
    name: string;
}

export interface CreatePosExpenseItemInput {
    itemName: string;
    hsnCode?: string;
    description?: string;
    price?: number;
    taxMode?: TaxMode;
    taxPercent?: number;
}

export interface CreatePosCompanyInput {
    companyName: string;
    legalName?: string;
    gstin?: string;
    phone?: string;
    email?: string;
    address?: string;
    pincode?: string;
    stateName?: string;
    stateCode?: string;
    financialYear?: string;
    isActive?: boolean;
}

interface ExpenseRowInput {
    /** Optional reference to a PosExpenseItem master (fills name/price/tax defaults). */
    expenseItemId?: number | string;
    itemName?: string;
    hsnCode?: string;
    description?: string;
    qty?: number | string;
    /** Per-unit amount. */
    price?: number | string;
    amount?: number | string;
    /** 'With Tax' = price is inclusive; 'Without Tax' = exclusive (tax added on top). */
    taxMode?: TaxMode;
    taxPercent?: number | string;
    discountPct?: number | string;
    discountFlat?: number | string;
    [extra: string]: unknown;
}

export interface CreatePosExpenseInput {
    expenseNo: string;
    expenseDate: string;
    categoryId?: number | null;
    gstApplied?: boolean;
    /** true → inter-state (IGST); false → intra-state (CGST + SGST). */
    otherState?: boolean;
    vendorName?: string;
    vendorGstin?: string;
    billNumber?: string;
    billDate?: string;
    /** 2-digit place-of-supply state code; drives intra/inter-state vs seller. */
    placeOfSupply?: string;
    itcClaimable?: boolean;
    payType?: string;
    rows?: ExpenseRowInput[];
    roundOff?: number;
    totalAmount?: number;
    netAmount?: number;
    description?: string;
    remarks?: string;
}

// ───── Day Book (cash/bank movement report) ─────
export type DayBookType = 'SALE' | 'RECEIPT' | 'PURCHASE' | 'PAYMENT' | 'EXPENSE';

export interface DayBookEntry {
    date: string;
    type: DayBookType;
    refNo: string;
    particulars: string;
    /** Payment mode (Cash / UPI / Card / …). */
    mode: string;
    inAmount: number;
    outAmount: number;
}

export interface DayBookReport {
    fromDate: string;
    toDate: string;
    /** Cumulative net cash movement BEFORE fromDate (not absolute drawer cash). */
    openingBalance: number;
    totalIn: number;
    totalOut: number;
    netFlow: number;
    closingBalance: number;
    entries: DayBookEntry[];
}

// ───── GST report (GSTR-style: output vs input tax) ─────
export interface GstSlabRow {
    gstPercent: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalTax: number;
}

export interface GstReportSection {
    taxableTotal: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    cessTotal: number;
    taxTotal: number;
    slabs: GstSlabRow[];
}

export interface GstReportCompany {
    companyName: string;
    gstin: string;
    stateName: string;
    stateCode: string;
}

export interface GstReport {
    fromDate: string;
    toDate: string;
    /** Active seller identity (filing header label). null if none configured. */
    company: GstReportCompany | null;
    /** Output tax — collected on sales (GSTR-1). */
    output: GstReportSection;
    /** Input tax credit — paid on purchases + expenses (GSTR-2 / ITC). */
    input: GstReportSection;
    /** output.taxTotal − input.taxTotal (positive = pay to govt, negative = credit). */
    netGstPayable: number;
}

// ───── Purchase report (date / supplier rollup) ─────
export interface PurchaseSupplierRow {
    supplier: string;
    billCount: number;
    taxable: number;
    tax: number;
    discount: number;
    net: number;
}

export interface PurchaseReport {
    fromDate: string;
    toDate: string;
    billCount: number;
    totalTaxable: number;
    totalTax: number;
    totalDiscount: number;
    totalNet: number;
    bySupplier: PurchaseSupplierRow[];
}

// ───── Expense report (category rollup) ─────
export interface ExpenseCategoryRow {
    categoryId: number | null;
    categoryName: string;
    count: number;
    taxable: number;
    tax: number;
    net: number;
}

export interface ExpenseReport {
    fromDate: string;
    toDate: string;
    expenseCount: number;
    totalTaxable: number;
    totalTax: number;
    totalNet: number;
    byCategory: ExpenseCategoryRow[];
}

function parseFlexDate(s: string | undefined, endOfDay: boolean): Date | null {
    if (!s) return null;
    const trimmed = String(s).trim();
    if (!trimmed) return null;
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        const [, d, m, y] = dmy;
        return endOfDay
            ? new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999)
            : new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    }
    const iso = new Date(trimmed);
    if (!isNaN(iso.getTime())) {
        if (endOfDay) iso.setHours(23, 59, 59, 999);
        else iso.setHours(0, 0, 0, 0);
        return iso;
    }
    return null;
}

@Injectable()
export class PharmaService {
    constructor(
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
        @Inject(EventBus) private eventBus: EventBus,
        @Inject(forwardRef(() => VendureForwardSyncService))
        private forwardSync: VendureForwardSyncService,
    ) {}

    // ───────────── TAX RESOLUTION ─────────────
    /** Load all ACTIVE tax masters into a Map keyed by id for per-row lookup. */
    private async loadTaxMasterMap(ctx: RequestContext): Promise<Map<number, PosTaxMaster>> {
        const masters = await this.connection
            .getRepository(ctx, PosTaxMaster)
            .find({ where: { status: 'ACTIVE' } as any });
        return new Map(masters.map(m => [Number(m.id), m]));
    }

    /**
     * Resolve the effective GST params for one item line. Preference order:
     *   1. item.taxMasterId → PosTaxMaster (rate + taxType drive IGST/EXEMPT/inclusive)
     *   2. legacy item.gstPercent fallback
     * The bill-level context (inclusive price mode, inter-state supply) can force
     * IGST / inclusive on top of whatever the master says.
     */
    private resolveItemTax(
        item: PharmaItem,
        masters: Map<number, PosTaxMaster>,
        billCtx: { inclusive: boolean; interState: boolean },
    ): { gstPercent: number; inclusive: boolean; interState: boolean } {
        let gstPercent = Number(item.gstPercent) || 0;
        let inclusive = billCtx.inclusive;
        let interState = billCtx.interState;

        if (item.taxMasterId != null) {
            const m = masters.get(Number(item.taxMasterId));
            if (m) {
                gstPercent = Number(m.ratePercent) || 0;
                if (m.taxType === 'EXEMPT') gstPercent = 0;
                if (m.taxType === 'IGST') interState = true;
                if (m.taxType === 'GST_INCLUSIVE') inclusive = true;
            }
        }
        return { gstPercent, inclusive, interState };
    }

    /**
     * Decide intra vs inter-state for a bill. If a placeOfSupply state code is
     * given and the active seller company has a stateCode, inter-state =
     * (placeOfSupply !== seller stateCode). Otherwise fall back to the client's
     * explicit otherState flag (legacy behaviour).
     */
    private async resolveBillInterState(
        ctx: RequestContext,
        placeOfSupply: string | undefined,
        fallbackOtherState: boolean | undefined,
    ): Promise<boolean> {
        const pos = String(placeOfSupply || '').trim();
        if (pos) {
            const company = await this.getActiveCompany(ctx);
            const sellerCode = String(company?.stateCode || '').trim();
            if (sellerCode) return pos !== sellerCode;
        }
        return !!fallbackOtherState;
    }

    /** Re-read the per-row GST breakup (attached during validation) as a LineTaxResult. */
    private rowToLineTax(row: Record<string, unknown>): LineTaxResult {
        const num = (v: unknown) => Number(v) || 0;
        return {
            gross: num(row.amount),
            discount: num(row.discountAmount),
            taxable: num(row.taxableAmount),
            gstPercent: num(row.gstPercent),
            cgst: num(row.cgstAmount),
            sgst: num(row.sgstAmount),
            igst: num(row.igstAmount),
            gstAmount: num(row.taxAmount),
            total: num(row.lineTotal),
        };
    }

    // Validates purchase/return rows + snapshots itemName/salesRate/mrpRate per row.
    // Throws on: empty rows, missing itemCode, unknown itemCode, blank itemName,
    // qty <= 0, puRate <= 0, or amount mismatch > ₹1.
    // Also computes the per-row GST breakup (taxable/cgst/sgst/igst) authoritatively.
    private async validateAndSnapshotPurchaseRows(
        ctx: RequestContext,
        rows: PurchaseRowInput[] | undefined,
        flowLabel: string,
        opts: { requirePuRate?: boolean } = { requirePuRate: true },
        billTaxCtx: { inclusive: boolean; interState: boolean } = {
            inclusive: false,
            interState: false,
        },
    ): Promise<PurchaseRowInput[]> {
        const list = rows || [];
        if (list.length === 0) {
            throw new UserInputError(`${flowLabel} requires at least one item row.`);
        }
        const itemRepo = this.connection.getRepository(ctx, PharmaItem);
        const unitRepo = this.connection.getRepository(ctx, PosUnit);
        const taxMasters = await this.loadTaxMasterMap(ctx);
        const enriched: PurchaseRowInput[] = [];
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            const code = row.itemCode || row.code;
            if (!code || String(code).trim() === '') {
                throw new UserInputError(`${flowLabel} row #${i + 1}: Item Name / Code is required.`);
            }
            const item = await itemRepo.findOne({ where: { code: String(code) } });
            if (!item) {
                throw new UserInputError(
                    `${flowLabel} row #${i + 1}: unknown item code "${code}". Add it in Item Master first.`,
                );
            }
            if (!item.itemName || item.itemName.trim() === '') {
                throw new UserInputError(
                    `${flowLabel} row #${i + 1}: Item master for code "${code}" has blank Item Name. Fix the master first.`,
                );
            }
            const qty = parseFloat(String(row.qty ?? 0)) || 0;
            if (qty <= 0) {
                throw new UserInputError(
                    `${flowLabel} row #${i + 1} ("${item.itemName}"): Quantity must be greater than 0.`,
                );
            }
            const puRate =
                parseFloat(String(row.puRate ?? '')) ||
                parseFloat(String(row.costRate ?? ''));
            if (opts.requirePuRate && (!puRate || puRate <= 0)) {
                throw new UserInputError(
                    `${flowLabel} row #${i + 1} ("${item.itemName}"): Purchase Rate must be greater than 0.`,
                );
            }

            // Upgrade A — Strict unit validation via PosItemUnit (N units per item).
            const rowUnit = String(row.unit || '').trim();
            if (rowUnit && rowUnit !== item.unit) {
                const itemUnits = await this.ensureItemUnitsBackfilled(ctx, item);
                const fromUnit = await unitRepo.findOne({ where: { code: rowUnit } as any });
                const ok =
                    !!fromUnit &&
                    itemUnits.some(
                        u => u.unitId === Number(fromUnit.id) && u.status === 'ACTIVE',
                    );
                if (!ok) {
                    const allowedCodes: string[] = [];
                    for (const iu of itemUnits) {
                        const u = await unitRepo.findOne({ where: { id: iu.unitId } as any });
                        if (u) allowedCodes.push(u.code);
                    }
                    throw new UserInputError(
                        `${flowLabel} row #${i + 1}: Unit "${rowUnit}" is not configured for "${item.itemName}". Allowed: ${allowedCodes.join(', ') || item.unit}.`,
                    );
                }
            }

            // Trust client-supplied amount; only fall back if missing.
            const safeRate = puRate || 0;
            const givenAmount = parseFloat(String(row.amount ?? 0)) || qty * safeRate;

            // Server-authoritative GST breakup for this line.
            const eff = this.resolveItemTax(item, taxMasters, billTaxCtx);
            const tax = computeLineTax({
                rate: safeRate,
                qty,
                gstPercent: eff.gstPercent,
                inclusive: eff.inclusive,
                interState: eff.interState,
                discountPct: parseFloat(String(row.discountPct ?? 0)) || 0,
                discountFlat: parseFloat(String(row.discountFlat ?? 0)) || 0,
            });

            const cessPercent = parseFloat(String(row.cessPct ?? row.cessPercent ?? 0)) || 0;
            const cessAmount = round2((tax.taxable * cessPercent) / 100);

            enriched.push({
                ...row,
                itemCode: String(code),
                code: String(code),
                itemName: (row.itemName && String(row.itemName).trim()) || item.itemName,
                hsnCode: String(row.hsnCode ?? item.hsnCode ?? ''),
                unit: rowUnit || item.unit || '',
                mrpRate: row.mrpRate ?? item.mrpRate,
                puRate: safeRate,
                amount: givenAmount,
                // ── GST breakup (computed server-side; mirror of frontend display) ──
                gstPercent: tax.gstPercent,
                priceInclusive: eff.inclusive,
                interState: eff.interState,
                taxableAmount: tax.taxable,
                cgstAmount: tax.cgst,
                sgstAmount: tax.sgst,
                igstAmount: tax.igst,
                cessPercent,
                cessAmount,
                taxAmount: tax.gstAmount,
                lineTotal: tax.total,
            });
        }
        return enriched;
    }

    private async validateAndSnapshotSaleItems(
        ctx: RequestContext,
        items: SaleRowInput[] | undefined,
        flowLabel: string,
        billTaxCtx: { interState: boolean } = { interState: false },
    ): Promise<SaleRowInput[]> {
        const list = items || [];
        if (list.length === 0) {
            throw new UserInputError(`${flowLabel} requires at least one item.`);
        }
        const itemRepo = this.connection.getRepository(ctx, PharmaItem);
        const unitRepo = this.connection.getRepository(ctx, PosUnit);
        const taxMasters = await this.loadTaxMasterMap(ctx);
        const enriched: SaleRowInput[] = [];
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            const code = row.code || row.itemCode;
            if (!code) {
                throw new UserInputError(`${flowLabel} item #${i + 1} is missing itemCode.`);
            }
            const item = await itemRepo.findOne({ where: { code: String(code) } });
            if (!item) {
                throw new UserInputError(`${flowLabel} item #${i + 1} references unknown itemCode "${code}".`);
            }
            if (!item.itemName || !item.itemName.trim()) {
                throw new UserInputError(
                    `${flowLabel} item #${i + 1}: master record for "${code}" has blank Item Name.`,
                );
            }
            const qty = parseFloat(String(row.qty ?? 0)) || 0;
            if (qty <= 0) {
                throw new UserInputError(`${flowLabel} item #${i + 1} ("${item.itemName}") must have qty > 0.`);
            }

            // Mandatory Sales Price per row (M3 hardening).
            const rate =
                parseFloat(String((row as any).rate ?? '')) ||
                parseFloat(String((row as any).salesRate ?? '')) ||
                parseFloat(String((row as any).saleRate ?? ''));
            if (!rate || rate <= 0) {
                throw new UserInputError(
                    `${flowLabel} item #${i + 1} ("${item.itemName}"): Sales Price is required (must be > 0).`,
                );
            }

            // Upgrade A — Strict unit validation via PosItemUnit (N units per item).
            const rowUnit = String((row as any).unit || '').trim();
            if (rowUnit && rowUnit !== item.unit) {
                const itemUnits = await this.ensureItemUnitsBackfilled(ctx, item);
                const fromUnit = await unitRepo.findOne({ where: { code: rowUnit } as any });
                const ok =
                    !!fromUnit &&
                    itemUnits.some(
                        u => u.unitId === Number(fromUnit.id) && u.status === 'ACTIVE',
                    );
                if (!ok) {
                    const allowedCodes: string[] = [];
                    for (const iu of itemUnits) {
                        const u = await unitRepo.findOne({ where: { id: iu.unitId } as any });
                        if (u) allowedCodes.push(u.code);
                    }
                    throw new UserInputError(
                        `${flowLabel} item #${i + 1}: Unit "${rowUnit}" is not configured for "${item.itemName}". Allowed: ${allowedCodes.join(', ') || item.unit}.`,
                    );
                }
            }

            // Server-authoritative GST breakup. For sales the inclusive/exclusive
            // choice is a per-item property (priceIncludesTax); inter-state (IGST)
            // is decided at bill level by the customer's place of supply.
            const eff = this.resolveItemTax(item, taxMasters, {
                inclusive: !!item.priceIncludesTax,
                interState: billTaxCtx.interState,
            });
            const tax = computeLineTax({
                rate,
                qty,
                gstPercent: eff.gstPercent,
                inclusive: eff.inclusive,
                interState: eff.interState,
                discountPct: parseFloat(String((row as any).discountPct ?? 0)) || 0,
                discountFlat: parseFloat(String((row as any).discountFlat ?? 0)) || 0,
            });

            const cessPercent = parseFloat(String((row as any).cessPct ?? (row as any).cessPercent ?? 0)) || 0;
            const cessAmount = round2((tax.taxable * cessPercent) / 100);

            enriched.push({
                ...row,
                code: String(code),
                itemCode: String(code),
                itemName: (row as any).itemName || item.itemName,
                hsnCode: String((row as any).hsnCode ?? item.hsnCode ?? ''),
                mrpRate: (row as any).mrpRate ?? item.mrpRate,
                unit: rowUnit || item.unit,
                rate,
                // ── GST breakup (computed server-side; mirror of frontend display) ──
                gstPercent: tax.gstPercent,
                priceInclusive: eff.inclusive,
                interState: eff.interState,
                taxableAmount: tax.taxable,
                cgstAmount: tax.cgst,
                sgstAmount: tax.sgst,
                igstAmount: tax.igst,
                cessPercent,
                cessAmount,
                taxAmount: tax.gstAmount,
                lineTotal: tax.total,
            } as SaleRowInput);
        }
        return enriched;
    }

    // ───────────── ITEMS ─────────────
    async listItems(ctx: RequestContext, includeCancelled = false): Promise<PharmaItem[]> {
        return this.connection.getRepository(ctx, PharmaItem).find({
            where: (includeCancelled ? {} : { status: 'ACTIVE' }) as any,
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async getItem(ctx: RequestContext, id: number | string): Promise<PharmaItem | null> {
        return this.connection
            .getRepository(ctx, PharmaItem)
            .findOne({ where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any });
    }

    async createItem(
        ctx: RequestContext,
        input: CreatePharmaItemInput & { sizes?: unknown[] },
    ): Promise<PharmaItem> {
        await this.ensureSeedUnits(ctx);
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaItem);
            await this.validateItemMasterInput(tCtx, input, null);
            // Priority 1 — Reject duplicate (itemName + brand) before code/barcode checks.
            await this.findActiveDuplicateByNameAndBrand(
                tCtx,
                String(input.itemName).trim(),
                String(input.brand || '').trim(),
            );
            const codeProvided = (input.code || '').trim();
            const finalCode = codeProvided || (await this.nextItemCode(tCtx));
            if (codeProvided) {
                const existing = await repo.findOne({ where: { code: finalCode } });
                if (existing) throw new UserInputError(`Item code "${finalCode}" already exists.`);
            }
            if (input.barcode && String(input.barcode).trim()) {
                const dup = await repo.findOne({ where: { barcode: String(input.barcode).trim() } });
                if (dup) throw new UserInputError(`Barcode "${input.barcode}" already used by item "${dup.itemName}".`);
            }
            const { wholesaleRate, wholesaleMinQty, retailRate, sizes, allowedUnits, ...rest } = input as any;
            const item = new PharmaItem({
                ...(rest as any),
                code: finalCode,
                itemName: String(input.itemName).trim(),
                sizesJson: sizes ? JSON.stringify(sizes) : '[]',
            });
            // Audit
            (item as any).createdByAdminId =
                ctx.activeUserId != null ? Number(ctx.activeUserId) : null;
            const saved = await repo.save(item);
            await this.upsertItemPriceTiers(tCtx, Number(saved.id), {
                retailRate: typeof retailRate === 'number' ? retailRate : undefined,
                wholesaleRate: typeof wholesaleRate === 'number' ? wholesaleRate : undefined,
                wholesaleMinQty: typeof wholesaleMinQty === 'number' ? wholesaleMinQty : undefined,
            });

            // Upgrade A — persist allowed units (replaces legacy 1+1 schema).
            if (Array.isArray(allowedUnits) && allowedUnits.length > 0) {
                await this.upsertItemUnits(tCtx, Number(saved.id), allowedUnits);
            }

            // Persist primary barcode in sub-table for multi-barcode lookup.
            if (saved.barcode && String(saved.barcode).trim()) {
                await this.connection
                    .getRepository(tCtx, PosItemBarcode)
                    .save(
                        new PosItemBarcode({
                            itemId: Number(saved.id),
                            barcode: String(saved.barcode).trim(),
                            isPrimary: true,
                            status: 'ACTIVE',
                        }),
                    );
            }

            // Opening stock — write as an OPENING ledger movement so the
            // invariant SUM(ledger) == snapshot holds from day one.
            const openingQty = Number((input as any).openingQty ?? saved.openingQty ?? 0) || 0;
            if (openingQty > 0 && saved.isStockBased) {
                if (!saved.openingStockDate) {
                    saved.openingStockDate = new Date().toISOString().slice(0, 10);
                    await repo.save(saved);
                }
                await this.writeLedger(
                    tCtx,
                    saved,
                    'OPENING',
                    Number(saved.id),
                    saved.code,
                    +openingQty,
                    saved.unit,
                    saved.openingStockDate,
                    'Opening stock',
                );
            }
            // M5 — Push to Vendure (Product + Variant upsert). Best-effort.
            await this.forwardSync.upsertProductFromItem(tCtx, saved);
            return saved;
        });
    }

    async updateItem(
        ctx: RequestContext,
        id: number | string,
        input: Partial<CreatePharmaItemInput> & { sizes?: unknown[] },
    ): Promise<PharmaItem> {
        await this.ensureSeedUnits(ctx);
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaItem);
            const item = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!item) throw new UserInputError('Item not found.');
            await this.validateItemMasterInput(tCtx, input as CreatePharmaItemInput, item);
            // Priority 1 — Reject rename collisions on (itemName + brand). Same row excluded.
            if (input.itemName !== undefined || (input as any).brand !== undefined) {
                const nextName = String((input.itemName ?? item.itemName) || '').trim();
                const nextBrand = String(((input as any).brand ?? item.brand) || '').trim();
                await this.findActiveDuplicateByNameAndBrand(
                    tCtx,
                    nextName,
                    nextBrand,
                    Number(item.id),
                );
            }
            const { wholesaleRate, wholesaleMinQty, retailRate, sizes, allowedUnits, ...rest } = input as any;
            if (input.barcode && String(input.barcode).trim() && input.barcode !== item.barcode) {
                const dup = await repo.findOne({ where: { barcode: String(input.barcode).trim() } });
                if (dup && dup.id !== item.id) {
                    throw new UserInputError(`Barcode "${input.barcode}" already used by item "${dup.itemName}".`);
                }
            }
            Object.assign(item, rest);
            if (input.itemName !== undefined) item.itemName = String(input.itemName).trim();
            if (sizes !== undefined) item.sizesJson = JSON.stringify(sizes);
            (item as any).updatedByAdminId =
                ctx.activeUserId != null ? Number(ctx.activeUserId) : null;
            const saved = await repo.save(item);
            await this.upsertItemPriceTiers(tCtx, Number(saved.id), {
                retailRate: typeof retailRate === 'number' ? retailRate : undefined,
                wholesaleRate: typeof wholesaleRate === 'number' ? wholesaleRate : undefined,
                wholesaleMinQty: typeof wholesaleMinQty === 'number' ? wholesaleMinQty : undefined,
            });
            // Upgrade A — replace allowed units if provided.
            if (Array.isArray(allowedUnits) && allowedUnits.length > 0) {
                await this.upsertItemUnits(tCtx, Number(saved.id), allowedUnits);
            }
            // M5 — Push updated item to Vendure.
            await this.forwardSync.upsertProductFromItem(tCtx, saved);
            return saved;
        });
    }

    async syncAllItemsToVendure(ctx: RequestContext): Promise<number> {
        return this.forwardSync.syncAllItemsToVendure(ctx);
    }

    // ───────────── M2 — TaxMaster ─────────────
    private seedTaxMastersRan = false;
    /**
     * Idempotent per-code upsert (same pattern as ensureSeedUnits — fixes the
     * all-or-nothing bug that left partial seeds blocking new codes).
     */
    private async ensureSeedTaxMasters(ctx: RequestContext): Promise<void> {
        if (this.seedTaxMastersRan) return;
        const repo = this.connection.getRepository(ctx, PosTaxMaster);
        const seed: Array<Partial<PosTaxMaster>> = [
            { code: 'EXEMPT', name: 'Exempt', ratePercent: 0, taxType: 'EXEMPT', isDefault: false },
            { code: 'GST_0', name: 'GST 0%', ratePercent: 0, taxType: 'GST_EXCLUSIVE', isDefault: false },
            { code: 'GST_5', name: 'GST 5%', ratePercent: 5, taxType: 'GST_EXCLUSIVE', isDefault: true },
            { code: 'GST_12', name: 'GST 12%', ratePercent: 12, taxType: 'GST_EXCLUSIVE' },
            { code: 'GST_18', name: 'GST 18%', ratePercent: 18, taxType: 'GST_EXCLUSIVE' },
            { code: 'GST_28', name: 'GST 28%', ratePercent: 28, taxType: 'GST_EXCLUSIVE' },
            { code: 'IGST_5', name: 'IGST 5%', ratePercent: 5, taxType: 'IGST' },
            { code: 'IGST_12', name: 'IGST 12%', ratePercent: 12, taxType: 'IGST' },
            { code: 'IGST_18', name: 'IGST 18%', ratePercent: 18, taxType: 'IGST' },
            { code: 'IGST_28', name: 'IGST 28%', ratePercent: 28, taxType: 'IGST' },
        ];
        for (const s of seed) {
            const existing = await repo.findOne({ where: { code: s.code! } as any });
            if (!existing) {
                await repo.save(new PosTaxMaster({ ...s, status: 'ACTIVE' }));
            } else if (existing.status !== 'ACTIVE') {
                existing.status = 'ACTIVE';
                await repo.save(existing);
            }
        }
        this.seedTaxMastersRan = true;
    }

    async listTaxMasters(ctx: RequestContext): Promise<PosTaxMaster[]> {
        await this.ensureSeedTaxMasters(ctx);
        return this.connection
            .getRepository(ctx, PosTaxMaster)
            .find({ where: { status: 'ACTIVE' }, order: { ratePercent: 'ASC' }, take: MAX_LIST });
    }

    async createTaxMaster(
        ctx: RequestContext,
        input: { code: string; name: string; ratePercent: number; taxType: PosTaxMaster['taxType']; isDefault?: boolean },
    ): Promise<PosTaxMaster> {
        const repo = this.connection.getRepository(ctx, PosTaxMaster);
        const dup = await repo.findOne({ where: { code: input.code, status: 'ACTIVE' } });
        if (dup) throw new UserInputError(`Tax code "${input.code}" already exists.`);
        return repo.save(new PosTaxMaster({ ...input, status: 'ACTIVE' }));
    }

    /**
     * Level-A "in use" guard. A tax master is considered in use if any ACTIVE
     * item references it via taxMasterId. Because a sale/purchase can only be
     * created from items, an item reference is the deterministic, reliable
     * signal that this tax is (or can be) used in transactions — no fragile
     * JSON scanning of historical bills required. Returns the referencing
     * item count (0 = free to edit/delete).
     */
    private async countItemsUsingTaxMaster(ctx: RequestContext, id: number): Promise<number> {
        return this.connection
            .getRepository(ctx, PharmaItem)
            .count({ where: { taxMasterId: id, status: 'ACTIVE' } as any });
    }

    /** Edit an existing ACTIVE tax master. All input fields are optional (partial update). */
    async updateTaxMaster(
        ctx: RequestContext,
        id: number | string,
        input: {
            code?: string;
            name?: string;
            ratePercent?: number;
            taxType?: PosTaxMaster['taxType'];
            isDefault?: boolean;
        },
    ): Promise<PosTaxMaster> {
        const repo = this.connection.getRepository(ctx, PosTaxMaster);
        const tax = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!tax) throw new UserInputError('Tax master not found.');
        if (tax.status === 'CANCELLED') throw new UserInputError('Cannot edit a cancelled tax master.');

        // Level-A: block edit once the tax is used by any item / transaction.
        const usedBy = await this.countItemsUsingTaxMaster(ctx, Number(tax.id));
        if (usedBy > 0) {
            throw new UserInputError(
                `Cannot edit this tax — it is being used in transactions (assigned to ${usedBy} item${
                    usedBy === 1 ? '' : 's'
                }). Create a new tax instead.`,
            );
        }

        if (input.code != null && String(input.code).trim() && input.code !== tax.code) {
            const dup = await repo.findOne({ where: { code: input.code, status: 'ACTIVE' } });
            if (dup) throw new UserInputError(`Tax code "${input.code}" already exists.`);
            tax.code = String(input.code).trim();
        }
        if (input.name != null) tax.name = String(input.name);
        if (input.ratePercent != null) {
            const rate = Number(input.ratePercent);
            if (!(rate >= 0)) throw new UserInputError('ratePercent must be 0 or greater.');
            tax.ratePercent = rate;
        }
        if (input.taxType != null) tax.taxType = input.taxType;
        if (input.isDefault != null) tax.isDefault = !!input.isDefault;
        return repo.save(tax);
    }

    /**
     * Soft-cancel a tax master (status → CANCELLED). Never hard-deleted because
     * past sales/purchases may reference it; cancelled masters drop out of
     * listTaxMasters() and the per-line resolver (which loads ACTIVE only).
     */
    async deleteTaxMaster(ctx: RequestContext, id: number | string): Promise<PosTaxMaster> {
        const repo = this.connection.getRepository(ctx, PosTaxMaster);
        const tax = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!tax) throw new UserInputError('Tax master not found.');
        if (tax.status === 'CANCELLED') throw new UserInputError('Tax master already cancelled.');

        // Level-A: block delete once the tax is used by any item / transaction.
        const usedBy = await this.countItemsUsingTaxMaster(ctx, Number(tax.id));
        if (usedBy > 0) {
            throw new UserInputError(
                `Cannot delete this tax — it is being used in transactions (assigned to ${usedBy} item${
                    usedBy === 1 ? '' : 's'
                }). Create a new tax instead.`,
            );
        }

        tax.status = 'CANCELLED';
        tax.isDefault = false;
        return repo.save(tax);
    }

    // ───────────── PosItemUnit (multi-unit per item) ─────────────
    /**
     * Replace the active PosItemUnit set for an item with the provided list.
     * `allowedUnits` is a list of {unitCode, conversionRate, isBase?}.
     * Rules: exactly one row must be `isBase=true`; all conversionRates > 0;
     * unique unitCodes; all codes must exist in PosUnit master.
     */
    async upsertItemUnits(
        ctx: RequestContext,
        itemId: number,
        allowedUnits: Array<{ unitCode: string; conversionRate: number; isBase?: boolean }>,
    ): Promise<PosItemUnit[]> {
        if (!Array.isArray(allowedUnits) || allowedUnits.length === 0) {
            throw new UserInputError('At least one allowed unit is required.');
        }
        const baseCount = allowedUnits.filter(u => !!u.isBase).length;
        if (baseCount !== 1) {
            throw new UserInputError('Exactly one allowed unit must be marked isBase: true.');
        }
        const codes = allowedUnits.map(u => String(u.unitCode || '').trim());
        if (codes.some(c => !c)) throw new UserInputError('Every allowed unit needs a unitCode.');
        if (new Set(codes).size !== codes.length) {
            throw new UserInputError('Duplicate unit codes in allowedUnits.');
        }
        for (const u of allowedUnits) {
            if (!(u.conversionRate > 0)) {
                throw new UserInputError(
                    `Conversion rate for unit "${u.unitCode}" must be > 0 (base row uses 1).`,
                );
            }
        }
        const unitRepo = this.connection.getRepository(ctx, PosUnit);
        const itemUnitRepo = this.connection.getRepository(ctx, PosItemUnit);

        // Resolve unit codes to ids; missing codes are rejected.
        const resolved: Array<{ unitId: number; conversionRate: number; isBase: boolean; unitCode: string }> = [];
        for (const u of allowedUnits) {
            const row = await unitRepo.findOne({ where: { code: u.unitCode, status: 'ACTIVE' } as any });
            if (!row) throw new UserInputError(`Unit code "${u.unitCode}" not found in unit master.`);
            resolved.push({
                unitId: Number(row.id),
                conversionRate: !!u.isBase ? 1 : Number(u.conversionRate),
                isBase: !!u.isBase,
                unitCode: u.unitCode,
            });
        }

        // Cancel any active rows not in the new set; upsert provided rows.
        const existing = await itemUnitRepo.find({
            where: { itemId: Number(itemId), status: 'ACTIVE' } as any,
        });
        const targetUnitIds = new Set(resolved.map(r => r.unitId));
        for (const row of existing) {
            if (!targetUnitIds.has(Number(row.unitId))) {
                row.status = 'CANCELLED';
                await itemUnitRepo.save(row);
            }
        }
        const saved: PosItemUnit[] = [];
        for (const r of resolved) {
            const found = existing.find(e => Number(e.unitId) === r.unitId);
            if (found) {
                found.conversionRate = r.conversionRate;
                found.isBase = r.isBase;
                found.status = 'ACTIVE';
                saved.push(await itemUnitRepo.save(found));
            } else {
                saved.push(
                    await itemUnitRepo.save(
                        new PosItemUnit({
                            itemId: Number(itemId),
                            unitId: r.unitId,
                            conversionRate: r.conversionRate,
                            isBase: r.isBase,
                            status: 'ACTIVE',
                        }),
                    ),
                );
            }
        }
        return saved;
    }

    async listItemUnits(ctx: RequestContext, itemId: number | string): Promise<PosItemUnit[]> {
        return this.connection.getRepository(ctx, PosItemUnit).find({
            where: {
                itemId: typeof itemId === 'string' ? parseInt(itemId, 10) : itemId,
                status: 'ACTIVE',
            } as any,
            order: { isBase: 'DESC', conversionRate: 'ASC' },
        });
    }

    async addItemUnit(
        ctx: RequestContext,
        input: { itemId: number; unitCode: string; conversionRate: number; isBase?: boolean },
    ): Promise<PosItemUnit> {
        if (!(input.conversionRate > 0)) {
            throw new UserInputError('conversionRate must be > 0.');
        }
        const unitRepo = this.connection.getRepository(ctx, PosUnit);
        const unit = await unitRepo.findOne({ where: { code: input.unitCode, status: 'ACTIVE' } as any });
        if (!unit) throw new UserInputError(`Unit code "${input.unitCode}" not found.`);
        const repo = this.connection.getRepository(ctx, PosItemUnit);
        const dup = await repo.findOne({
            where: { itemId: input.itemId, unitId: Number(unit.id), status: 'ACTIVE' } as any,
        });
        if (dup) throw new UserInputError(`Unit "${input.unitCode}" is already configured for this item.`);
        if (input.isBase) {
            // Demote any existing base.
            const currentBase = await repo.findOne({
                where: { itemId: input.itemId, isBase: true, status: 'ACTIVE' } as any,
            });
            if (currentBase) {
                currentBase.isBase = false;
                await repo.save(currentBase);
            }
        }
        return repo.save(
            new PosItemUnit({
                itemId: input.itemId,
                unitId: Number(unit.id),
                conversionRate: input.isBase ? 1 : input.conversionRate,
                isBase: !!input.isBase,
                status: 'ACTIVE',
            }),
        );
    }

    async removeItemUnit(ctx: RequestContext, id: number | string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PosItemUnit);
        const row = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!row) throw new UserInputError('Item unit not found.');
        if (row.isBase) {
            throw new UserInputError('Cannot remove the base unit. Promote another unit to base first.');
        }
        row.status = 'CANCELLED';
        await repo.save(row);
        return true;
    }

    // ───────────── M2 — Item Barcode (multi) ─────────────
    async listItemBarcodes(ctx: RequestContext, itemId: number | string): Promise<PosItemBarcode[]> {
        return this.connection.getRepository(ctx, PosItemBarcode).find({
            where: { itemId: typeof itemId === 'string' ? parseInt(itemId, 10) : itemId, status: 'ACTIVE' } as any,
            order: { isPrimary: 'DESC', createdAt: 'ASC' },
            take: MAX_LIST,
        });
    }

    async addItemBarcode(
        ctx: RequestContext,
        input: { itemId: number; barcode: string; isPrimary?: boolean },
    ): Promise<PosItemBarcode> {
        const repo = this.connection.getRepository(ctx, PosItemBarcode);
        const code = String(input.barcode || '').trim();
        if (!code) throw new UserInputError('Barcode is required.');
        // Validate EAN-13 check digit when the value looks like an EAN-13 (13 numeric
        // digits). Other formats (e.g. alphanumeric Code128 SKUs) are accepted as-is.
        if (/^\d{13}$/.test(code) && !isValidEan13(code)) {
            throw new UserInputError(`Invalid EAN-13 check digit for "${code}".`);
        }
        const dup = await repo.findOne({ where: { barcode: code } });
        if (dup) throw new UserInputError(`Barcode "${code}" already used.`);
        return repo.save(
            new PosItemBarcode({
                itemId: input.itemId,
                barcode: code,
                isPrimary: !!input.isPrimary,
                status: 'ACTIVE',
            }),
        );
    }

    /** True if a barcode value is already used by any item (sub-table or master). */
    private async barcodeExists(ctx: RequestContext, code: string): Promise<boolean> {
        const bc = await this.connection
            .getRepository(ctx, PosItemBarcode)
            .findOne({ where: { barcode: code } as any });
        if (bc) return true;
        const item = await this.connection
            .getRepository(ctx, PharmaItem)
            .findOne({ where: { barcode: code } as any });
        return !!item;
    }

    /** Allocate a unique in-store EAN-13: deterministic per item id, random on collision. */
    private async allocateUniqueEan13(ctx: RequestContext, itemId: number): Promise<string> {
        const candidate = ean13ForItemId(itemId);
        if (!(await this.barcodeExists(ctx, candidate))) return candidate;
        for (let i = 0; i < 25; i++) {
            const rnd = randomEan13();
            if (!(await this.barcodeExists(ctx, rnd))) return rnd;
        }
        throw new UserInputError('Could not allocate a unique barcode; please retry.');
    }

    /**
     * Generate + persist a valid in-store EAN-13 for one item. Idempotent-ish:
     * the generated code is stored in PosItemBarcode (source of truth) and mirrored
     * to the item-master `barcode` field when it is empty, so POS scan-lookup works.
     */
    async generateItemBarcode(ctx: RequestContext, itemId: number | string): Promise<PosItemBarcode> {
        const id = typeof itemId === 'string' ? parseInt(itemId, 10) : itemId;
        const itemRepo = this.connection.getRepository(ctx, PharmaItem);
        const item = await itemRepo.findOne({ where: { id } as any });
        if (!item) throw new UserInputError('Item not found.');

        const code = await this.allocateUniqueEan13(ctx, id);
        const isPrimary = !String(item.barcode || '').trim();
        const saved = await this.addItemBarcode(ctx, { itemId: id, barcode: code, isPrimary });
        if (isPrimary) {
            item.barcode = code;
            await itemRepo.save(item);
        }
        return saved;
    }

    /** Bulk: generate an EAN-13 for every ACTIVE item that has no barcode yet. */
    async generateMissingItemBarcodes(ctx: RequestContext): Promise<PosItemBarcode[]> {
        const items = await this.connection
            .getRepository(ctx, PharmaItem)
            .find({ where: { status: 'ACTIVE' } as any, take: MAX_LIST });
        const out: PosItemBarcode[] = [];
        for (const it of items) {
            if (String(it.barcode || '').trim()) continue;
            const existing = await this.listItemBarcodes(ctx, Number(it.id));
            if (existing.length > 0) continue;
            out.push(await this.generateItemBarcode(ctx, Number(it.id)));
        }
        return out;
    }

    async removeItemBarcode(ctx: RequestContext, id: number | string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PosItemBarcode);
        const row = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!row) throw new UserInputError('Barcode not found.');
        row.status = 'CANCELLED';
        await repo.save(row);
        return true;
    }

    // ───────────── M2 — Auto-fill for Sales/Purchase forms ─────────────
    /**
     * Resolves an item by code OR any registered barcode and returns the
     * full pricing+stock payload Sales/Purchase forms need to auto-fill rows.
     * **Server is the only authority for prices** — clients must not invent rates.
     */
    async pharmaItemForTransaction(
        ctx: RequestContext,
        opts: { code?: string; barcode?: string },
    ): Promise<unknown> {
        if (!opts.code && !opts.barcode) {
            throw new UserInputError('Provide code or barcode.');
        }
        const itemRepo = this.connection.getRepository(ctx, PharmaItem);
        const snapRepo = this.connection.getRepository(ctx, PosItemStockSnapshot);
        const unitRepo = this.connection.getRepository(ctx, PosUnit);
        const tierRepo = this.connection.getRepository(ctx, PosItemPriceTier);
        const barcodeRepo = this.connection.getRepository(ctx, PosItemBarcode);

        let item: PharmaItem | null = null;
        if (opts.code) item = await itemRepo.findOne({ where: { code: opts.code } });
        if (!item && opts.barcode) {
            const bc = await barcodeRepo.findOne({
                where: { barcode: opts.barcode, status: 'ACTIVE' } as any,
            });
            if (bc) {
                item = await itemRepo.findOne({ where: { id: bc.itemId } as any });
            } else {
                item = await itemRepo.findOne({ where: { barcode: opts.barcode } });
            }
        }
        if (!item) return null;

        const snap = await snapRepo.findOne({
            where: { itemId: Number(item.id), warehouseId: null } as any,
        });
        const currentStock = snap ? Number(snap.currentStock) || 0 : Number(item.minStkQty) || 0;

        const baseUnit = item.baseUnitId
            ? await unitRepo.findOne({ where: { id: item.baseUnitId } as any })
            : null;
        const secondaryUnit = item.secondaryUnitId
            ? await unitRepo.findOne({ where: { id: item.secondaryUnitId } as any })
            : null;

        const tiers = await tierRepo.find({
            where: { itemId: Number(item.id), status: 'ACTIVE' } as any,
            order: { tierType: 'ASC', minQty: 'ASC' },
        });

        // Upgrade A — return the FULL allowed-units list (back-filled from
        // legacy columns on first read), not just base + 1 secondary.
        const itemUnits = await this.ensureItemUnitsBackfilled(ctx, item);
        const allowedUnits: Array<{ unitCode: string; conversionRate: number; isBase: boolean }> = [];
        for (const iu of itemUnits) {
            const u = await unitRepo.findOne({ where: { id: iu.unitId } as any });
            if (u) {
                allowedUnits.push({
                    unitCode: u.code,
                    conversionRate: Number(iu.conversionRate) || 1,
                    isBase: !!iu.isBase,
                });
            }
        }

        return {
            id: item.id,
            code: item.code,
            itemName: item.itemName,
            hsnCode: item.hsnCode,
            unit: item.unit,
            baseUnit: baseUnit ? baseUnit.code : item.unit,
            secondaryUnit: secondaryUnit ? secondaryUnit.code : '',
            conversionRate: item.conversionRate,
            mrpRate: item.mrpRate,
            purchaseRate: item.purchaseRate,
            salesRate: item.salesRate,
            lastSaleRate: item.lastSaleRate,
            lastPurchaseRate: item.lastPurchaseRate,
            currentStock,
            isStockBased: item.isStockBased,
            taxName: item.taxName,
            gstPercent: item.gstPercent,
            taxMasterId: item.taxMasterId,
            purchaseTaxMode: item.purchaseTaxMode,
            salesTaxMode: item.salesTaxMode,
            priceIncludesTax: item.priceIncludesTax,
            tiers: tiers.map(t => ({
                tierType: t.tierType,
                rate: t.rate,
                minQty: t.minQty,
            })),
            allowedUnits,
        };
    }

    /**
     * Validates Item Master input (create or update). Pass existingItem=null on create
     * or the entity instance on update so partial inputs use the persisted value.
     */
    /**
     * Priority 1 — Duplicate item guard.
     *
     * Throws `UserInputError` when an ACTIVE PharmaItem already exists with
     * the same `(itemName, brand)` combination, case-insensitive. CANCELLED
     * rows are tombstones — they never block name re-use.
     *
     * @param excludeId pass the current item's id when called from
     *   `updateItem` so the item can keep its own name on a no-op rename.
     */
    private async findActiveDuplicateByNameAndBrand(
        ctx: RequestContext,
        itemName: string,
        brand: string,
        excludeId?: number,
    ): Promise<void> {
        if (!itemName || !itemName.trim()) return;
        const repo = this.connection.getRepository(ctx, PharmaItem);
        const qb = repo
            .createQueryBuilder('i')
            .where('LOWER(TRIM(i.itemName)) = :name', {
                name: itemName.toLowerCase().trim(),
            })
            .andWhere("LOWER(TRIM(COALESCE(i.brand, ''))) = :brand", {
                brand: brand.toLowerCase().trim(),
            })
            .andWhere('i.status = :status', { status: 'ACTIVE' });
        if (excludeId != null) {
            qb.andWhere('i.id != :id', { id: excludeId });
        }
        const dup = await qb.getOne();
        if (dup) {
            const brandPart = dup.brand ? ` (brand: ${dup.brand})` : '';
            throw new UserInputError(
                `Item already exists: "${dup.itemName}"${brandPart} — id ${dup.id}, code ${dup.code}.`,
            );
        }
    }

    private async validateItemMasterInput(
        ctx: RequestContext,
        input: Partial<CreatePharmaItemInput>,
        existingItem: PharmaItem | null,
    ): Promise<void> {
        const fold = <T>(provided: T | undefined, fallback: T): T =>
            provided === undefined ? fallback : provided;

        // ── Unify purchaseRate & costRate: treat them as a SINGLE value. ──
        // Prefer explicit purchaseRate; else explicit costRate; else keep existing.
        // The resolved value is written to BOTH so they can never diverge — so giving
        // either one on create/update is enough.
        const provP = input.purchaseRate !== undefined ? Number(input.purchaseRate) : undefined;
        const provC = (input as any).costRate !== undefined ? Number((input as any).costRate) : undefined;
        let unifiedRate: number;
        if (provP !== undefined && provP > 0) unifiedRate = provP;
        else if (provC !== undefined && provC > 0) unifiedRate = provC;
        else if (provP !== undefined) unifiedRate = provP; // explicit 0 (e.g. SERVICE)
        else if (provC !== undefined) unifiedRate = provC;
        else unifiedRate = Number(existingItem?.purchaseRate ?? (existingItem as any)?.costRate ?? 0);
        (input as any).purchaseRate = unifiedRate;
        (input as any).costRate = unifiedRate;

        const itemName = String(fold(input.itemName as string | undefined, existingItem?.itemName || '')).trim();
        if (itemName.length < 2) throw new UserInputError('Item Name must be at least 2 characters.');

        const unitCode = String(fold(input.unit as string | undefined, existingItem?.unit || '')).trim();
        if (unitCode && unitCode !== 'NA') {
            const unitRepo = this.connection.getRepository(ctx, PosUnit);
            const u = await unitRepo.findOne({ where: { code: unitCode, status: 'ACTIVE' } });
            if (!u) throw new UserInputError(`Unit "${unitCode}" not found in Unit master.`);
        }

        const isStockBased = !!fold(input.isStockBased as boolean | undefined, existingItem?.isStockBased ?? false);
        const purchaseRate = Number(fold(input.purchaseRate as number | undefined, existingItem?.purchaseRate ?? 0));
        const salesRate = Number(fold(input.salesRate as number | undefined, existingItem?.salesRate ?? 0));
        const mrpRate = Number(fold(input.mrpRate as number | undefined, existingItem?.mrpRate ?? 0));
        const itemType = String(
            fold((input as any).itemType as string | undefined, (existingItem as any)?.itemType || 'PRODUCT'),
        );
        if (itemType !== 'PRODUCT' && itemType !== 'SERVICE') {
            throw new UserInputError(`itemType must be PRODUCT or SERVICE (got "${itemType}").`);
        }

        // PRODUCT requires a positive purchase rate; SERVICE skips it.
        if (itemType === 'PRODUCT' && !(purchaseRate > 0)) {
            throw new UserInputError('Purchase Price is required (must be > 0) for PRODUCT items.');
        }
        if (isStockBased && purchaseRate < 0) throw new UserInputError('Purchase rate cannot be negative.');
        if (salesRate <= 0) throw new UserInputError('Sales Rate must be greater than 0.');
        if (mrpRate > 0 && salesRate > 0 && mrpRate < salesRate) {
            throw new UserInputError(`MRP (${mrpRate}) cannot be less than Sales Rate (${salesRate}).`);
        }

        const gstPercent = Number(fold(input.gstPercent as number | undefined, existingItem?.gstPercent ?? 5));
        if (!VALID_GST_SLABS.has(gstPercent)) {
            throw new UserInputError(`GST % "${gstPercent}" is not a valid slab. Allowed: ${[...VALID_GST_SLABS].join(', ')}.`);
        }

        const secondaryUnitId = fold(input.secondaryUnitId as number | undefined, existingItem?.secondaryUnitId ?? null);
        const baseUnitId = fold(input.baseUnitId as number | undefined, existingItem?.baseUnitId ?? null);
        const conversionRate = Number(fold(input.conversionRate as number | undefined, existingItem?.conversionRate ?? 1));
        if (secondaryUnitId != null) {
            if (baseUnitId == null) throw new UserInputError('Base Unit is required when Secondary Unit is set.');
            if (!conversionRate || conversionRate <= 0) {
                throw new UserInputError('Conversion Rate must be > 0 when Secondary Unit is set.');
            }
        }

        const wholesaleRate = (input as any).wholesaleRate;
        const wholesaleMinQty = (input as any).wholesaleMinQty;
        if (typeof wholesaleRate === 'number' && wholesaleRate > 0) {
            if (!wholesaleMinQty || Number(wholesaleMinQty) <= 0) {
                throw new UserInputError('Wholesale Min Qty must be > 0 when Wholesale Rate is set.');
            }
        }
    }

    private async nextItemCode(ctx: RequestContext): Promise<string> {
        const repo = this.connection.getRepository(ctx, PharmaItem);
        const latest = await repo.find({ order: { id: 'DESC' }, take: 1 });
        const nextId = latest.length > 0 ? Number(latest[0].id) + 1 : 1;
        return `ITM-${String(nextId).padStart(5, '0')}`;
    }

    private async upsertItemPriceTiers(
        ctx: RequestContext,
        itemId: number,
        tiers: { retailRate?: number; wholesaleRate?: number; wholesaleMinQty?: number },
    ): Promise<void> {
        const tierRepo = this.connection.getRepository(ctx, PosItemPriceTier);
        const existing = await tierRepo.find({ where: { itemId, status: 'ACTIVE' } });
        const findByType = (t: 'SALE' | 'WHOLESALE') => existing.find(e => e.tierType === t);

        if (typeof tiers.retailRate === 'number' && tiers.retailRate > 0) {
            const row = findByType('SALE');
            if (row) {
                row.rate = tiers.retailRate;
                await tierRepo.save(row);
            } else {
                await tierRepo.save(
                    new PosItemPriceTier({
                        itemId,
                        tierType: 'SALE',
                        label: 'Retail',
                        rate: tiers.retailRate,
                        minQty: 0,
                        taxMode: 'Without Tax',
                        discountPct: 0,
                        discountFlat: 0,
                        discountType: 'Percentage',
                        status: 'ACTIVE',
                    }),
                );
            }
        }

        if (typeof tiers.wholesaleRate === 'number' && tiers.wholesaleRate > 0) {
            const minQty = tiers.wholesaleMinQty ?? 1;
            const row = findByType('WHOLESALE');
            if (row) {
                row.rate = tiers.wholesaleRate;
                row.minQty = minQty;
                await tierRepo.save(row);
            } else {
                await tierRepo.save(
                    new PosItemPriceTier({
                        itemId,
                        tierType: 'WHOLESALE',
                        label: 'Wholesale',
                        rate: tiers.wholesaleRate,
                        minQty,
                        taxMode: 'Without Tax',
                        discountPct: 0,
                        discountFlat: 0,
                        discountType: 'Percentage',
                        status: 'ACTIVE',
                    }),
                );
            }
        }
    }

    /**
     * Convert qty entered in `rowUnit` into the item's stock-keeping (base) unit.
     * Stock is kept in `item.unit` which equals the base unit code.
     */
    /**
     * Resolves PosItemUnit rows for an item, lazily back-filling from the
     * legacy 1-base + 1-secondary columns on first access. Idempotent.
     *
     * Convention: PosItemUnit.conversionRate = "how many base units in 1 of this unit".
     * Legacy PharmaItem.conversionRate = "how many secondary in 1 base" — INVERTED.
     * Backfill maps: new = 1 / legacy.
     */
    private async ensureItemUnitsBackfilled(
        ctx: RequestContext,
        item: PharmaItem,
    ): Promise<PosItemUnit[]> {
        const itemUnitRepo = this.connection.getRepository(ctx, PosItemUnit);
        const unitRepo = this.connection.getRepository(ctx, PosUnit);
        const existing = await itemUnitRepo.find({
            where: { itemId: Number(item.id), status: 'ACTIVE' } as any,
        });
        if (existing.length > 0) return existing;

        // No rows yet — seed from legacy columns if present.
        const rows: PosItemUnit[] = [];
        const baseCode = (item.unit || '').trim();
        if (baseCode) {
            let baseUnitId = item.baseUnitId ?? null;
            if (baseUnitId == null) {
                const u = await unitRepo.findOne({ where: { code: baseCode } as any });
                if (u) baseUnitId = Number(u.id);
            }
            if (baseUnitId != null) {
                rows.push(
                    await itemUnitRepo.save(
                        new PosItemUnit({
                            itemId: Number(item.id),
                            unitId: baseUnitId,
                            conversionRate: 1,
                            isBase: true,
                            status: 'ACTIVE',
                        }),
                    ),
                );
            }
        }
        if (item.secondaryUnitId != null && item.conversionRate > 0) {
            // Legacy: 1 base = item.conversionRate secondary  →  1 secondary = 1/item.conversionRate base
            rows.push(
                await itemUnitRepo.save(
                    new PosItemUnit({
                        itemId: Number(item.id),
                        unitId: item.secondaryUnitId,
                        conversionRate: 1 / item.conversionRate,
                        isBase: false,
                        status: 'ACTIVE',
                    }),
                ),
            );
        }
        return rows;
    }

    /**
     * Convert qty entered in `rowUnit` to the item's base unit.
     * Reads PosItemUnit (with legacy backfill on first call). Throws if the
     * requested unit is not configured for this item.
     */
    private async convertToBaseUnit(
        ctx: RequestContext,
        item: PharmaItem,
        qty: number,
        rowUnitCode: string | undefined,
    ): Promise<number> {
        const baseCode = (item.unit || '').trim();
        const fromCode = (rowUnitCode || baseCode || '').trim();
        if (!fromCode || !baseCode || fromCode === baseCode) return qty;

        const allowed = await this.ensureItemUnitsBackfilled(ctx, item);
        if (allowed.length === 0) {
            // No legacy data either → nothing configured.
            throw new UserInputError(
                `Unit "${fromCode}" is not configured for item "${item.itemName}". Add it under Item Master allowed units.`,
            );
        }

        const unitRepo = this.connection.getRepository(ctx, PosUnit);
        const fromUnit = await unitRepo.findOne({ where: { code: fromCode } as any });
        if (!fromUnit) {
            throw new UserInputError(`Unit code "${fromCode}" not found in unit master.`);
        }
        const match = allowed.find(r => r.unitId === Number(fromUnit.id));
        if (!match || match.status !== 'ACTIVE' || !(match.conversionRate > 0)) {
            throw new UserInputError(
                `Unit "${fromCode}" is not configured for item "${item.itemName}". Allowed units must be added in Item Master.`,
            );
        }
        return qty * match.conversionRate;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fix 1 — PosSetting (singleton)
    // Singleton config row. Cached after first read; cache invalidated on
    // updateSetting(). All hot-path checks (e.g. writeLedger) consult cache.
    // ═══════════════════════════════════════════════════════════════════════

    private cachedSetting: PosSetting | null = null;

    private async getSetting(ctx: RequestContext): Promise<PosSetting> {
        if (this.cachedSetting) return this.cachedSetting;
        const repo = this.connection.getRepository(ctx, PosSetting);
        let row = await repo.findOne({ where: {}, order: { id: 'ASC' } });
        if (!row) {
            row = await repo.save(new PosSetting({}));
        }
        this.cachedSetting = row;
        return row;
    }

    async getPosSetting(ctx: RequestContext): Promise<PosSetting> {
        return this.getSetting(ctx);
    }

    async updatePosSetting(
        ctx: RequestContext,
        input: Partial<PosSetting>,
    ): Promise<PosSetting> {
        const repo = this.connection.getRepository(ctx, PosSetting);
        const row = await this.getSetting(ctx);
        const next = Object.assign(row, input, {
            updatedByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
        });
        const saved = await repo.save(next);
        this.cachedSetting = saved;
        return saved;
    }

    private seedUnitsRan = false;
    /**
     * Idempotent per-code upsert. Was previously all-or-nothing (`if count===0`),
     * which silently skipped the seed if even one row pre-existed — so a partial
     * seed from an earlier session left KG/etc. missing forever. Now: loop each
     * code, insert if absent, reactivate if cancelled.
     */
    private async ensureSeedUnits(ctx: RequestContext): Promise<void> {
        if (this.seedUnitsRan) return;
        const repo = this.connection.getRepository(ctx, PosUnit);
        for (const u of SEED_UNITS) {
            const existing = await repo.findOne({ where: { code: u.code } as any });
            if (!existing) {
                await repo.save(new PosUnit({ ...u, status: 'ACTIVE' }));
            } else if (existing.status !== 'ACTIVE') {
                existing.status = 'ACTIVE';
                await repo.save(existing);
            }
        }
        this.seedUnitsRan = true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // M1 — Immutable Stock Ledger + Snapshot
    //
    // ALL stock writes go through writeLedger(). ALL stock reads go through
    // PosItemStockSnapshot. PharmaItem.currentStock is a one-way mirror
    // synced from snapshot inside writeLedger() — never mutate directly.
    //
    // Invariant continuously verified by getStockReconciliation():
    //   SUM(pos_stock_ledger.qty WHERE itemId=X) == snapshot.currentStock
    // ═══════════════════════════════════════════════════════════════════════

    private stockBackfilledRan = false;
    /**
     * One-time bootstrap: for every PharmaItem with legacy minStkQty > 0 and
     * no snapshot row yet, create the snapshot and an OPENING ledger entry so
     * the invariant holds from day one. Idempotent (skips items that already
     * have a snapshot).
     */
    private async ensureStockBackfilled(ctx: RequestContext): Promise<void> {
        if (this.stockBackfilledRan) return;
        const itemRepo = this.connection.getRepository(ctx, PharmaItem);
        const snapRepo = this.connection.getRepository(ctx, PosItemStockSnapshot);
        const ledgerRepo = this.connection.getRepository(ctx, PosStockLedger);
        const items = await itemRepo.find({ take: MAX_LIST });
        for (const item of items) {
            const existing = await snapRepo.findOne({ where: { itemId: item.id, warehouseId: null } as any });
            if (existing) continue;
            const opening = Number(item.minStkQty) || 0;
            const snap = await snapRepo.save(
                new PosItemStockSnapshot({
                    itemId: Number(item.id),
                    warehouseId: null,
                    currentStock: opening,
                    reservedQty: 0,
                }),
            );
            if (opening !== 0) {
                await ledgerRepo.save(
                    new PosStockLedger({
                        itemId: Number(item.id),
                        itemCode: item.code,
                        refType: 'OPENING',
                        refId: 0,
                        refNo: item.code,
                        movementDate: new Date().toISOString().slice(0, 10),
                        qty: opening,
                        unit: item.unit || '',
                        previousBalance: 0,
                        runningBalance: opening,
                        warehouseId: null,
                        reason: 'Backfill from legacy minStkQty',
                        createdByAdminId: null,
                    }),
                );
            }
            // Mirror snapshot back into PharmaItem.currentStock
            item.currentStock = snap.currentStock;
            await itemRepo.save(item);
        }
        this.stockBackfilledRan = true;
    }

    /**
     * The single point of stock mutation. Caller passes the item, the movement
     * metadata, and a raw delta (signed) in any of the item's allowed units.
     * `writeLedger`:
     *   1. Converts delta to base unit
     *   2. SELECT FOR UPDATE on the snapshot row (creates if missing)
     *   3. Computes runningBalance = previousBalance + baseDelta
     *   4. Throws on negative result (unless OPENING)
     *   5. Inserts the immutable ledger row
     *   6. Updates the snapshot.currentStock
     *   7. Mirrors snapshot.currentStock into PharmaItem.currentStock and minStkQty
     *
     * MUST be invoked inside a `connection.withTransaction(...)` block (the
     * caller passes the transactional ctx).
     */
    private async writeLedger(
        tCtx: RequestContext,
        item: PharmaItem,
        refType: PosStockLedger['refType'],
        refId: number,
        refNo: string,
        rawDelta: number,
        unit: string | undefined,
        movementDate: string,
        reason: string,
    ): Promise<{ previousBalance: number; runningBalance: number; baseDelta: number }> {
        if (!Number.isFinite(rawDelta) || rawDelta === 0) {
            return { previousBalance: 0, runningBalance: 0, baseDelta: 0 };
        }
        // Convert magnitude, preserve sign
        const sign = rawDelta < 0 ? -1 : 1;
        const baseMagnitude = await this.convertToBaseUnit(tCtx, item, Math.abs(rawDelta), unit);
        const baseDelta = sign * baseMagnitude;

        const snapRepo = this.connection.getRepository(tCtx, PosItemStockSnapshot);
        const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
        const ledgerRepo = this.connection.getRepository(tCtx, PosStockLedger);

        // Pessimistic write-lock to serialise concurrent stock mutations
        let snap = await snapRepo
            .createQueryBuilder('s')
            .setLock('pessimistic_write')
            .where('s.itemId = :itemId AND s.warehouseId IS NULL', { itemId: Number(item.id) })
            .getOne();
        if (!snap) {
            // First touch of this item — seed snapshot (lock by insert)
            snap = await snapRepo.save(
                new PosItemStockSnapshot({
                    itemId: Number(item.id),
                    warehouseId: null,
                    currentStock: Number(item.minStkQty) || 0,
                    reservedQty: 0,
                }),
            );
        }
        const previousBalance = Number(snap.currentStock) || 0;
        const runningBalance = previousBalance + baseDelta;

        // Fix 1 — Consult PosSetting.allowNegativeStock (strict default = false).
        // OPENING movements always allowed (initial seed cannot be blocked).
        if (runningBalance < 0 && refType !== 'OPENING') {
            const cfg = await this.getSetting(tCtx);
            if (!cfg.allowNegativeStock) {
                throw new UserInputError(
                    `Cannot ${baseDelta < 0 ? 'reduce' : 'change'} stock for "${item.itemName}" (code ${item.code}): would result in ${runningBalance} from current ${previousBalance}. Enable allowNegativeStock in PosSetting to permit.`,
                );
            }
        }

        await ledgerRepo.save(
            new PosStockLedger({
                itemId: Number(item.id),
                itemCode: item.code,
                refType,
                refId,
                refNo,
                movementDate: movementDate || new Date().toISOString().slice(0, 10),
                qty: baseDelta,
                unit: unit || item.unit || '',
                previousBalance,
                runningBalance,
                warehouseId: null,
                reason: reason || '',
                createdByAdminId: tCtx.activeUserId != null ? Number(tCtx.activeUserId) : null,
            }),
        );

        snap.currentStock = runningBalance;
        await snapRepo.save(snap);

        // Mirror into PharmaItem for backward-compat reads. NEVER touch these columns elsewhere.
        item.currentStock = runningBalance;
        item.minStkQty = runningBalance;
        await itemRepo.save(item);

        // M5 — Push updated stock to Vendure variant. Best-effort; failures logged inside.
        await this.forwardSync.syncStockOnHand(tCtx, item);

        return { previousBalance, runningBalance, baseDelta };
    }

    /**
     * Reconciliation check: SUM(ledger.qty) per item must equal snapshot.currentStock.
     * Returns rows where they diverge.
     */
    async getStockReconciliation(ctx: RequestContext): Promise<unknown> {
        const ledgerRepo = this.connection.getRepository(ctx, PosStockLedger);
        const snapRepo = this.connection.getRepository(ctx, PosItemStockSnapshot);
        const sums = await ledgerRepo
            .createQueryBuilder('l')
            .select('l.itemId', 'itemId')
            .addSelect('l.itemCode', 'itemCode')
            .addSelect('SUM(l.qty)', 'ledgerSum')
            .groupBy('l.itemId')
            .addGroupBy('l.itemCode')
            .getRawMany<{ itemId: number; itemCode: string; ledgerSum: string }>();
        const snaps = await snapRepo.find({ take: MAX_LIST });
        const snapMap = new Map(snaps.map(s => [s.itemId, Number(s.currentStock) || 0]));
        const rows: unknown[] = [];
        let mismatched = 0;
        for (const row of sums) {
            const ledgerSum = parseFloat(row.ledgerSum) || 0;
            const snapStock = snapMap.get(row.itemId) ?? 0;
            const diff = Math.round((ledgerSum - snapStock) * 1e4) / 1e4;
            if (Math.abs(diff) > 0.0001) mismatched++;
            rows.push({
                itemId: row.itemId,
                itemCode: row.itemCode,
                ledgerSum,
                snapshotStock: snapStock,
                diff,
                ok: Math.abs(diff) <= 0.0001,
            });
        }
        return { totalItems: rows.length, mismatched, rows };
    }

    async listStockLedger(
        ctx: RequestContext,
        opts: { itemId?: number; itemCode?: string; refType?: string; limit?: number } = {},
    ): Promise<PosStockLedger[]> {
        const repo = this.connection.getRepository(ctx, PosStockLedger);
        const qb = repo.createQueryBuilder('l').orderBy('l.createdAt', 'DESC');
        if (opts.itemId) qb.andWhere('l.itemId = :itemId', { itemId: opts.itemId });
        if (opts.itemCode) qb.andWhere('l.itemCode = :itemCode', { itemCode: opts.itemCode });
        if (opts.refType) qb.andWhere('l.refType = :refType', { refType: opts.refType });
        qb.limit(Math.min(opts.limit || 500, MAX_LIST));
        return qb.getMany();
    }

    async listStockSnapshots(ctx: RequestContext): Promise<PosItemStockSnapshot[]> {
        await this.ensureStockBackfilled(ctx);
        return this.connection.getRepository(ctx, PosItemStockSnapshot).find({ take: MAX_LIST });
    }

    /**
     * Fix 5 — Live integrity check across all stock-related tables. Returns a
     * single shape consolidating reconciliation + V2-deferred-fields + settings
     * so the user can hit one query to confirm the invariant after E2E flows.
     */
    async getStockIntegrityReport(ctx: RequestContext): Promise<unknown> {
        const reconciliation = (await this.getStockReconciliation(ctx)) as any;
        const setting = await this.getSetting(ctx);
        const ledgerRepo = this.connection.getRepository(ctx, PosStockLedger);
        const total = await ledgerRepo.count();
        const opening = await ledgerRepo.count({ where: { refType: 'OPENING' } as any });
        const purchase = await ledgerRepo.count({ where: { refType: 'PURCHASE' } as any });
        const sale = await ledgerRepo.count({ where: { refType: 'SALE' } as any });
        const saleReturn = await ledgerRepo.count({ where: { refType: 'SALE_RETURN' } as any });
        const purchaseReturn = await ledgerRepo.count({ where: { refType: 'PURCHASE_RETURN' } as any });
        const cancels = await ledgerRepo.count({
            where: [
                { refType: 'PURCHASE_CANCEL' },
                { refType: 'SALE_CANCEL' },
                { refType: 'PURCHASE_RETURN_CANCEL' },
                { refType: 'SALE_RETURN_CANCEL' },
                { refType: 'ADJUSTMENT_CANCEL' },
            ] as any,
        });
        return {
            invariantHolds: reconciliation.mismatched === 0,
            totalItems: reconciliation.totalItems,
            mismatched: reconciliation.mismatched,
            mismatchedRows: (reconciliation.rows || []).filter((r: any) => !r.ok),
            ledgerCounts: {
                total,
                opening,
                purchase,
                sale,
                saleReturn,
                purchaseReturn,
                cancels,
            },
            settings: {
                allowNegativeStock: setting.allowNegativeStock,
                allowReturnRateOverride: setting.allowReturnRateOverride,
            },
        };
    }

    /**
     * Fix 2 — Soft-cancel an item. Does NOT remove the row (ledger references
     * would orphan). Sets status=CANCELLED + audit fields. The item stops
     * appearing in default `pharmaItems` queries but ledger/historical reads
     * still resolve it.
     *
     * Refuses to cancel if currentStock > 0 — caller must consume or adjust
     * stock to zero first (forces the cleanup decision into the open).
     */
    async cancelItem(
        ctx: RequestContext,
        id: number | string,
        reason?: string,
    ): Promise<PharmaItem> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaItem);
            const snapRepo = this.connection.getRepository(tCtx, PosItemStockSnapshot);
            const item = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!item) throw new UserInputError('Item not found.');
            if (item.status === 'CANCELLED') {
                throw new UserInputError('Item already cancelled.');
            }
            const snap = await snapRepo.findOne({
                where: { itemId: Number(item.id), warehouseId: null } as any,
            });
            const currentStock = snap ? Number(snap.currentStock) || 0 : 0;
            if (currentStock !== 0) {
                throw new UserInputError(
                    `Cannot cancel "${item.itemName}": current stock is ${currentStock}. Adjust to zero first.`,
                );
            }
            item.status = 'CANCELLED';
            item.cancelledAt = new Date();
            item.cancelledByAdminId = ctx.activeUserId != null ? Number(ctx.activeUserId) : null;
            item.cancelReason = reason || '';
            return repo.save(item);
        });
    }

    /** @deprecated use cancelItem() — alias preserved for the existing GraphQL surface. */
    async deleteItem(ctx: RequestContext, id: number | string): Promise<boolean> {
        await this.cancelItem(ctx, id, 'Legacy delete call');
        return true;
    }

    // ───────────── PURCHASES ─────────────
    /**
     * Build a TypeORM where-condition for a 'YYYY-MM-DD' string date column.
     * Lexicographic compare == chronological for that format. Returns undefined
     * when neither bound is given (no date filter).
     */
    private dateRangeWhere(fromDate?: string, toDate?: string): unknown {
        const f = String(fromDate || '').trim();
        const t = String(toDate || '').trim();
        if (f && t) return Between(f, t);
        if (f) return MoreThanOrEqual(f);
        if (t) return LessThanOrEqual(t);
        return undefined;
    }

    async listPurchases(
        ctx: RequestContext,
        fromDate?: string,
        toDate?: string,
        includeCancelled = false,
    ): Promise<PharmaPurchase[]> {
        const where: any = includeCancelled ? {} : { status: 'ACTIVE' };
        const dr = this.dateRangeWhere(fromDate, toDate);
        if (dr) where.purDate = dr;
        return this.connection
            .getRepository(ctx, PharmaPurchase)
            .find({ where, order: { createdAt: 'DESC' }, take: MAX_LIST });
    }

    async createPurchase(
        ctx: RequestContext,
        input: CreatePharmaPurchaseInput,
    ): Promise<PharmaPurchase> {
        if (!input.supplier || !String(input.supplier).trim()) {
            throw new UserInputError('Supplier name is required.');
        }
        if (!input.purNo || !String(input.purNo).trim()) {
            throw new UserInputError('Bill Number is required.');
        }
        if (!input.purDate || !String(input.purDate).trim()) {
            throw new UserInputError('Bill Date is required.');
        }

        const billInclusive = String(input.taxMode || 'Exclusive').toLowerCase() === 'inclusive';
        // Auto intra/inter-state from seller stateCode vs supplier placeOfSupply.
        const interState = await this.resolveBillInterState(
            ctx,
            input.placeOfSupply,
            input.otherState,
        );
        const rows = await this.validateAndSnapshotPurchaseRows(ctx, input.rows, 'Purchase', undefined, {
            inclusive: billInclusive,
            interState,
        });

        // Server-authoritative GST totals from the per-line breakup.
        const taxSummary = summarizeTax(rows.map(r => this.rowToLineTax(r)));
        const billDiscount = Number(input.totalDiscA ?? 0) || 0;
        const roundOff = Number(input.roundOff ?? 0) || 0;
        const serverNet = round2(taxSummary.linesTotal - billDiscount + roundOff);

        // Total sanity: client netAmount must match server computation (±₹2 + roundOff).
        const declaredTotal = Number(input.netAmount ?? serverNet);
        if (Math.abs(serverNet - declaredTotal) > 2) {
            throw new UserInputError(
                `Bill total mismatch: server computes ₹${serverNet.toFixed(2)} (taxable ₹${taxSummary.taxableTotal.toFixed(
                    2,
                )} + GST ₹${taxSummary.taxTotal.toFixed(2)} − discount ₹${billDiscount.toFixed(
                    2,
                )} + round-off ₹${roundOff.toFixed(2)}) but netAmount is ₹${declaredTotal.toFixed(2)}.`,
            );
        }

        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaPurchase);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);

            // Duplicate bill number guard.
            const dup = await repo.findOne({ where: { purNo: String(input.purNo).trim() } });
            if (dup) throw new UserInputError(`Bill Number "${input.purNo}" already used.`);

            const p = new PharmaPurchase({
                ...input,
                purNo: String(input.purNo).trim(),
                supplier: String(input.supplier).trim(),
                supplierPhone: input.supplierPhone || '',
                supplierGstin: String(input.supplierGstin || '').trim().toUpperCase(),
                stateOfSupply: input.stateOfSupply || '',
                placeOfSupply: String(input.placeOfSupply || '').trim(),
                itcEligible: input.itcEligible !== false,
                reverseCharge: !!input.reverseCharge,
                rowsJson: JSON.stringify(rows),
                // Override client tax/totals with server-computed authoritative values.
                totalAmount: taxSummary.taxableTotal,
                totalDiscA: billDiscount,
                totalTax: taxSummary.taxTotal,
                roundOff,
                netAmount: serverNet,
                remarks: input.remarks ?? null,
                createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
            const saved = await repo.save(p);

            for (const row of rows) {
                const code = row.itemCode || row.code;
                if (!code) continue;
                const qty = parseFloat(String(row.qty ?? 0)) || 0;
                const freeQty = parseFloat(String(row.freeQty ?? 0)) || 0;
                if (qty <= 0 && freeQty <= 0) continue;

                const item = await itemRepo.findOne({ where: { code: String(code) } });
                if (!item) continue;
                const puRate = parseFloat(String(row.puRate ?? 0)) || 0;
                if (puRate > 0) {
                    item.lastPurchaseRate = puRate;
                    await itemRepo.save(item);
                }
                if (!item.isStockBased) continue;

                await this.writeLedger(
                    tCtx,
                    item,
                    'PURCHASE',
                    Number(saved.id),
                    saved.purNo,
                    +(qty + freeQty),
                    row.unit,
                    saved.purDate,
                    `Purchase ${saved.purNo}`,
                );
            }

            await this.eventBus.publish(new PosPurchaseCreatedEvent(tCtx, saved));
            return saved;
        });
    }

    /**
     * Soft-cancel a purchase. Writes a reversing PURCHASE_CANCEL ledger entry
     * per row instead of hard-deleting. Original purchase row stays in DB with
     * status='CANCELLED' for audit.
     */
    async cancelPurchase(
        ctx: RequestContext,
        id: number | string,
        reason?: string,
    ): Promise<PharmaPurchase> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaPurchase);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const p = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!p) throw new UserInputError('Purchase not found.');
            if (p.status === 'CANCELLED') throw new UserInputError('Purchase already cancelled.');

            const rows: PurchaseRowInput[] = (() => {
                try { return JSON.parse(p.rowsJson || '[]') || []; } catch { return []; }
            })();
            for (const row of rows) {
                const code = row.itemCode || row.code;
                if (!code) continue;
                const qty = parseFloat(String(row.qty ?? 0)) || 0;
                const freeQty = parseFloat(String(row.freeQty ?? 0)) || 0;
                const stockDelta = qty + freeQty;
                if (stockDelta <= 0) continue;

                const item = await itemRepo.findOne({ where: { code: String(code) } });
                if (!item || !item.isStockBased) continue;
                await this.writeLedger(
                    tCtx,
                    item,
                    'PURCHASE_CANCEL',
                    Number(p.id),
                    p.purNo,
                    -stockDelta,
                    row.unit,
                    new Date().toISOString().slice(0, 10),
                    reason || `Cancel purchase ${p.purNo}`,
                );
            }

            p.status = 'CANCELLED';
            p.cancelledAt = new Date();
            p.cancelledByAdminId = ctx.activeUserId != null ? Number(ctx.activeUserId) : null;
            p.cancelReason = reason || '';
            return repo.save(p);
        });
    }

    /** @deprecated use cancelPurchase() — kept temporarily so the GraphQL surface keeps working. */
    async deletePurchase(ctx: RequestContext, id: number | string): Promise<boolean> {
        await this.cancelPurchase(ctx, id, 'Legacy delete call');
        return true;
    }

    // ───────────── PAYMENTS ─────────────
    async listPayments(
        ctx: RequestContext,
        fromDate?: string,
        toDate?: string,
    ): Promise<PharmaPayment[]> {
        const where: any = {};
        const dr = this.dateRangeWhere(fromDate, toDate);
        if (dr) where.payDate = dr;
        return this.connection
            .getRepository(ctx, PharmaPayment)
            .find({ where, order: { createdAt: 'DESC' }, take: MAX_LIST });
    }

    async createPayment(ctx: RequestContext, input: CreatePharmaPaymentInput): Promise<PharmaPayment> {
        // C2 — validation
        const payNo = String(input.payNo || '').trim();
        if (!payNo) throw new UserInputError('Payment Number (payNo) is required.');
        const supplierName = String(input.supplierName || '').trim();
        if (!supplierName) throw new UserInputError('Supplier name is required for a payment.');
        // Settlement amount = totalPaying + totalDisc (discount also reduces payable).
        const toApply = Math.round(
            (Number((input as any).totalPaying) || 0) + (Number((input as any).totalDisc) || 0),
        );
        if (toApply <= 0) {
            throw new UserInputError('Payment amount (totalPaying + totalDisc) must be greater than zero.');
        }

        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaPayment);

            // Duplicate payNo guard.
            if (await repo.findOne({ where: { payNo } })) {
                throw new UserInputError(`Payment Number "${payNo}" already used.`);
            }

            // Lock all SUPPLIER ledgers for this party (FIFO order), then enforce the rules.
            const ledgerRepo = this.connection.getRepository(tCtx, Ledger);
            const partyLedgers = await ledgerRepo
                .createQueryBuilder('l')
                .setLock('pessimistic_write')
                .where('l.type = :type', { type: 'SUPPLIER' })
                .andWhere('LOWER(l.partyName) = :name', { name: supplierName.toLowerCase() })
                .orderBy('l.invoiceDate', 'ASC')
                .addOrderBy('l.id', 'ASC')
                .getMany();

            if (partyLedgers.length === 0) {
                throw new UserInputError(
                    `No supplier ledger found for "${supplierName}". A payment can only be recorded against an existing party.`,
                );
            }
            const openLedgers = partyLedgers.filter(l => Number(l.balance) > 0);
            if (openLedgers.length === 0) {
                throw new UserInputError(
                    `Supplier "${supplierName}" has no open balance — all invoices are already fully settled. (Advance payment is a separate flow, not yet supported.)`,
                );
            }
            const totalOpen = openLedgers.reduce((s, l) => s + Number(l.balance), 0);
            if (toApply > totalOpen) {
                throw new UserInputError(
                    `Payment ${toApply} exceeds the supplier's total open balance ${totalOpen}. Overpayment is not allowed.`,
                );
            }

            // FIFO settlement.
            let remaining = toApply;
            for (const l of openLedgers) {
                if (remaining <= 0) break;
                const pay = Math.min(remaining, Number(l.balance));
                l.paidAmount = Number(l.paidAmount) + pay;
                l.balance = Number(l.amount) - l.paidAmount;
                l.status =
                    l.balance <= 0 ? 'FULLY_PAID' : l.paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';
                await ledgerRepo.save(l);
                remaining -= pay;
            }

            const p = new PharmaPayment({
                ...(input as any),
                payNo,
                rowsJson: JSON.stringify(input.rows || []),
            });
            return repo.save(p);
        });
    }

    async deletePayment(ctx: RequestContext, id: number | string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PharmaPayment);
        const p = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!p) throw new UserInputError('Payment not found.');
        await repo.remove(p);
        return true;
    }

    // ───────────── RECEIPTS ─────────────
    async listReceipts(
        ctx: RequestContext,
        fromDate?: string,
        toDate?: string,
    ): Promise<PharmaReceipt[]> {
        const where: any = {};
        const dr = this.dateRangeWhere(fromDate, toDate);
        if (dr) where.docDate = dr;
        return this.connection
            .getRepository(ctx, PharmaReceipt)
            .find({ where, order: { createdAt: 'DESC' }, take: MAX_LIST });
    }

    async createReceipt(ctx: RequestContext, input: CreatePharmaReceiptInput): Promise<PharmaReceipt> {
        // C2 — validation
        const docNo = String(input.docNo || '').trim();
        if (!docNo) throw new UserInputError('Receipt Number (docNo) is required.');
        const accHead = String(input.accHead || '').trim();
        if (!accHead) throw new UserInputError('Account head (customer name) is required for a receipt.');
        // Settlement amount = recAmount (received from customer).
        const toApply = Math.round(Number((input as any).recAmount) || 0);
        if (toApply <= 0) {
            throw new UserInputError('Receipt amount (recAmount) must be greater than zero.');
        }

        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaReceipt);

            // Duplicate docNo guard.
            if (await repo.findOne({ where: { docNo } })) {
                throw new UserInputError(`Receipt Number "${docNo}" already used.`);
            }

            // Lock all CUSTOMER ledgers for this party (FIFO order), then enforce the rules.
            const ledgerRepo = this.connection.getRepository(tCtx, Ledger);
            const partyLedgers = await ledgerRepo
                .createQueryBuilder('l')
                .setLock('pessimistic_write')
                .where('l.type = :type', { type: 'CUSTOMER' })
                .andWhere('LOWER(l.partyName) = :name', { name: accHead.toLowerCase() })
                .orderBy('l.invoiceDate', 'ASC')
                .addOrderBy('l.id', 'ASC')
                .getMany();

            if (partyLedgers.length === 0) {
                throw new UserInputError(
                    `No customer ledger found for "${accHead}". A receipt can only be recorded against an existing party.`,
                );
            }
            const openLedgers = partyLedgers.filter(l => Number(l.balance) > 0);
            if (openLedgers.length === 0) {
                throw new UserInputError(
                    `Customer "${accHead}" has no open balance — all invoices are already fully settled. (Advance receipt is a separate flow, not yet supported.)`,
                );
            }
            const totalOpen = openLedgers.reduce((s, l) => s + Number(l.balance), 0);
            if (toApply > totalOpen) {
                throw new UserInputError(
                    `Receipt ${toApply} exceeds the customer's total open balance ${totalOpen}. Overpayment is not allowed.`,
                );
            }

            // FIFO settlement.
            let remaining = toApply;
            for (const l of openLedgers) {
                if (remaining <= 0) break;
                const rec = Math.min(remaining, Number(l.balance));
                l.paidAmount = Number(l.paidAmount) + rec;
                l.balance = Number(l.amount) - l.paidAmount;
                l.status =
                    l.balance <= 0 ? 'FULLY_PAID' : l.paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';
                await ledgerRepo.save(l);
                remaining -= rec;
            }

            const r = new PharmaReceipt({
                ...(input as any),
                docNo,
                rowsJson: JSON.stringify(input.rows || []),
            });
            return repo.save(r);
        });
    }

    async deleteReceipt(ctx: RequestContext, id: number | string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PharmaReceipt);
        const r = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!r) throw new UserInputError('Receipt not found.');
        await repo.remove(r);
        return true;
    }

    // ───────────── TOKENS ─────────────
    async listTokens(ctx: RequestContext, date?: string): Promise<PharmaToken[]> {
        const repo = this.connection.getRepository(ctx, PharmaToken);
        if (date) {
            return repo.find({ where: { tokenDate: date }, order: { tokenNo: 'ASC' }, take: MAX_LIST });
        }
        return repo.find({ order: { createdAt: 'DESC' }, take: MAX_LIST });
    }

    async createToken(ctx: RequestContext, input: CreatePharmaTokenInput): Promise<PharmaToken> {
        const repo = this.connection.getRepository(ctx, PharmaToken);
        const t = new PharmaToken(input as any);
        return repo.save(t);
    }

    async deleteToken(ctx: RequestContext, id: number | string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PharmaToken);
        const t = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!t) throw new UserInputError('Token not found.');
        await repo.remove(t);
        return true;
    }

    // ───────────── SALES ─────────────
    async listSales(
        ctx: RequestContext,
        fromDate?: string,
        toDate?: string,
        includeCancelled = false,
    ): Promise<PharmaSale[]> {
        const repo = this.connection.getRepository(ctx, PharmaSale);
        const fromDt = parseFlexDate(fromDate, false);
        const toDt = parseFlexDate(toDate, true);
        const statusFilter = includeCancelled ? {} : { status: 'ACTIVE' };
        if (fromDt && toDt) {
            return repo.find({
                where: { createdAt: Between(fromDt, toDt), ...statusFilter } as any,
                order: { createdAt: 'DESC' },
                take: MAX_LIST,
            });
        }
        return repo.find({
            where: statusFilter as any,
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async getSale(ctx: RequestContext, id: number | string): Promise<PharmaSale | null> {
        return this.connection.getRepository(ctx, PharmaSale).findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
    }

    // Step 2 — bill-no lookup for walk-in return processing. ACTIVE only.
    async getSaleByBillNo(ctx: RequestContext, billNo: string): Promise<PharmaSale | null> {
        const bn = String(billNo || '').trim();
        if (!bn) return null;
        return this.connection.getRepository(ctx, PharmaSale).findOne({
            where: { billNo: bn, status: 'ACTIVE' } as any,
        });
    }

    async createSale(ctx: RequestContext, input: CreatePharmaSaleInput): Promise<PharmaSale> {
        // M3 — bill metadata validation
        if (!input.billNo || !String(input.billNo).trim()) {
            throw new UserInputError('Bill Number is required.');
        }
        if (!input.billDate || !String(input.billDate).trim()) {
            throw new UserInputError('Bill Date is required.');
        }

        // M3 — Credit-sale customer guard
        const saleType = String(input.saleType || 'CASH').toUpperCase();
        // Step 2 — strict payment-type enum (LOCKED set).
        if (!ALLOWED_SALE_PAYMENT_TYPES.includes(saleType)) {
            throw new UserInputError(
                `Invalid payment type "${input.saleType}". Allowed: ${ALLOWED_SALE_PAYMENT_TYPES.join(', ')}.`,
            );
        }
        if (saleType === 'CREDIT') {
            const name = String(input.customerName || '').trim();
            const phone = String(input.customerPhone || '').trim();
            if (!name || name.toLowerCase() === 'walk-in' || !phone) {
                throw new UserInputError(
                    'Credit sale requires both Customer Name and Customer Phone.',
                );
            }
        }

        // M3 — Server-side payment-split reconciliation + balanceDue
        const grandTotal = Number(input.grandTotal || 0);
        const cash = Number(input.cashAmount || 0);
        const upi = Number(input.upiAmount || 0);
        const card = Number(input.cardAmount || 0);
        const cheque = Number(input.chequeAmount || 0);
        const online = Number(input.onlineAmount || 0);
        const received = Number(input.receivedAmount || 0);
        const split = cash + upi + card + cheque + online;
        if (received > 0 && Math.abs(split - received) > 1) {
            throw new UserInputError(
                `Payment split (cash ${cash} + UPI ${upi} + card ${card} + cheque ${cheque} + online ${online} = ${split}) does not reconcile to received ${received}.`,
            );
        }
        // Always compute balanceDue server-side; do not trust client value.
        const computedReceived = received > 0 ? received : split;
        const computedBalance = Math.max(0, grandTotal - computedReceived);

        // Auto intra/inter-state from seller stateCode vs customer placeOfSupply.
        const interState = await this.resolveBillInterState(ctx, input.placeOfSupply, input.otherState);
        const items = await this.validateAndSnapshotSaleItems(ctx, input.items, 'Sale', { interState });

        // Server-authoritative GST totals from the per-line breakup.
        const taxSummary = summarizeTax(items.map(r => this.rowToLineTax(r)));
        const billDiscount = Number(input.discount || 0);
        const transport = Number(input.transportCharges || 0);
        const roundOff = Number(input.roundOff || 0);
        const serverGrand = round2(taxSummary.linesTotal - billDiscount + transport + roundOff);
        // Reject if the client's grand total disagrees with the server computation.
        if (grandTotal > 0 && Math.abs(serverGrand - grandTotal) > 1) {
            throw new UserInputError(
                `Bill total mismatch: server computes ₹${serverGrand.toFixed(2)} (taxable ₹${taxSummary.taxableTotal.toFixed(
                    2,
                )} + GST ₹${taxSummary.taxTotal.toFixed(2)} − discount ₹${billDiscount.toFixed(
                    2,
                )} + transport ₹${transport.toFixed(2)} + round-off ₹${roundOff.toFixed(2)}) but grandTotal is ₹${grandTotal.toFixed(2)}.`,
            );
        }

        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaSale);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);

            // M3 — Duplicate billNo guard
            const dupBill = await repo.findOne({ where: { billNo: String(input.billNo).trim() } });
            if (dupBill) {
                throw new UserInputError(`Bill Number "${input.billNo}" already used.`);
            }

            // Persist sale first so writeLedger has a refId.
            const customerGstin = String(input.customerGstin || '').trim().toUpperCase();
            const sale = new PharmaSale({
                ...input,
                billNo: String(input.billNo).trim(),
                itemsJson: JSON.stringify(items),
                // Override client tax/subtotal with server-computed authoritative values.
                subtotal: taxSummary.taxableTotal,
                taxAmount: taxSummary.taxTotal,
                roundOff,
                customerGstin,
                placeOfSupply: String(input.placeOfSupply || '').trim(),
                // Auto-classify: GSTIN present => B2B, else B2C.
                invoiceType: customerGstin ? 'B2B' : 'B2C',
                reverseCharge: !!input.reverseCharge,
                receivedAmount: computedReceived,
                balanceDue: computedBalance,
                status: 'ACTIVE',
                createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
            const saved = await repo.save(sale);

            for (const row of items) {
                const code = row.code || row.itemCode;
                if (!code) continue;
                const qty = parseFloat(String(row.qty ?? 0)) || 0;
                if (qty <= 0) continue;

                const dbItem = await itemRepo.findOne({ where: { code: String(code) } });
                if (!dbItem) continue;

                const rate =
                    parseFloat(String(row.rate ?? '')) ||
                    parseFloat(String(row.salesRate ?? '')) ||
                    parseFloat(String(row.saleRate ?? ''));
                if (!isNaN(rate) && rate > 0) {
                    dbItem.lastSaleRate = rate;
                    await itemRepo.save(dbItem);
                }
                if (!dbItem.isStockBased) continue;

                await this.writeLedger(
                    tCtx,
                    dbItem,
                    'SALE',
                    Number(saved.id),
                    saved.billNo,
                    -qty,
                    (row as any).unit,
                    saved.billDate,
                    `Sale ${saved.billNo}`,
                );
            }

            await this.eventBus.publish(new PosSaleCreatedEvent(tCtx, saved));
            return saved;
        });
    }

    /**
     * Soft-cancel a sale. Writes a reversing SALE_CANCEL ledger entry per item
     * (restoring stock) instead of hard-deleting. Original sale row remains
     * with status='CANCELLED' for audit.
     */
    async cancelSale(
        ctx: RequestContext,
        id: number | string,
        reason?: string,
    ): Promise<PharmaSale> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PharmaSale);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const s = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!s) throw new UserInputError('Sale not found.');
            if (s.status === 'CANCELLED') throw new UserInputError('Sale already cancelled.');

            const items: SaleRowInput[] = (() => {
                try { return JSON.parse(s.itemsJson || '[]') || []; } catch { return []; }
            })();
            for (const row of items) {
                const code = row.code || row.itemCode;
                if (!code) continue;
                const qty = parseFloat(String(row.qty ?? 0)) || 0;
                if (qty <= 0) continue;
                const dbItem = await itemRepo.findOne({ where: { code: String(code) } });
                if (!dbItem || !dbItem.isStockBased) continue;
                await this.writeLedger(
                    tCtx,
                    dbItem,
                    'SALE_CANCEL',
                    Number(s.id),
                    s.billNo,
                    +qty,
                    (row as any).unit,
                    new Date().toISOString().slice(0, 10),
                    reason || `Cancel sale ${s.billNo}`,
                );
            }

            // H2 — reverse the customer Ledger receivable for this (now cancelled) sale.
            // A credit / balance-due sale auto-creates a CUSTOMER ledger row on creation;
            // without this, cancelling left a phantom receivable open. Mirrors the
            // sales-return ledger logic. No-op for cash sales with no ledger row.
            const ledgerRepo = this.connection.getRepository(tCtx, Ledger);
            const ledger = await ledgerRepo
                .createQueryBuilder('l')
                .setLock('pessimistic_write')
                .where('l.type = :type', { type: 'CUSTOMER' })
                .andWhere('l.invoiceNumber = :inv', { inv: s.billNo })
                .getOne();
            if (ledger) {
                const newAmount = Math.max(0, Number(ledger.amount) - Math.round(Number(s.grandTotal) || 0));
                const newBalance = Math.max(0, newAmount - Number(ledger.paidAmount));
                ledger.amount = newAmount;
                ledger.balance = newBalance;
                ledger.status =
                    newBalance === 0
                        ? 'FULLY_PAID'
                        : Number(ledger.paidAmount) > 0
                            ? 'PARTIALLY_PAID'
                            : 'PENDING';
                await ledgerRepo.save(ledger);
            }

            s.status = 'CANCELLED';
            s.cancelledAt = new Date();
            s.cancelledByAdminId = ctx.activeUserId != null ? Number(ctx.activeUserId) : null;
            s.cancelReason = reason || '';
            return repo.save(s);
        });
    }

    /** @deprecated use cancelSale() — kept temporarily so the GraphQL surface keeps working. */
    async deleteSale(ctx: RequestContext, id: number | string): Promise<boolean> {
        await this.cancelSale(ctx, id, 'Legacy delete call');
        return true;
    }

    async getCurrentStock(
        ctx: RequestContext,
        onlyLowStock?: boolean,
        onlyStockBased?: boolean,
    ): Promise<unknown> {
        // Ensure snapshot is backfilled before reporting.
        await this.ensureStockBackfilled(ctx);
        const itemRepo = this.connection.getRepository(ctx, PharmaItem);
        const snapRepo = this.connection.getRepository(ctx, PosItemStockSnapshot);
        const all = await itemRepo.find({ order: { itemName: 'ASC' }, take: MAX_LIST });
        const snaps = await snapRepo.find({ take: MAX_LIST });
        const snapMap = new Map(snaps.map(s => [s.itemId, Number(s.currentStock) || 0]));

        const num = (v: unknown): number => parseFloat(String(v ?? 0)) || 0;
        const rows: unknown[] = [];
        let lowStockCount = 0;
        let stockTrackedCount = 0;
        let totalStockUnits = 0;

        for (const it of all) {
            // Snapshot is the source of truth. Fall back to legacy mirror only if snapshot missing.
            const currentStock = snapMap.has(Number(it.id))
                ? (snapMap.get(Number(it.id)) as number)
                : num(it.minStkQty);
            const minStock = num(it.minStock);
            const isLowStock = currentStock <= minStock;

            if (onlyStockBased && !it.isStockBased) continue;
            if (onlyLowStock && !isLowStock) continue;

            if (it.isStockBased) stockTrackedCount++;
            if (isLowStock) lowStockCount++;
            totalStockUnits += currentStock;

            rows.push({
                id: it.id,
                code: it.code,
                itemName: it.itemName,
                tamilName: it.tamilName,
                category: it.category,
                groupName: it.groupName,
                unit: it.unit,
                salesRate: num(it.salesRate),
                mrpRate: num(it.mrpRate),
                currentStock,
                minStock,
                maxStock: num(it.maxStock),
                isStockBased: !!it.isStockBased,
                isLowStock,
            });
        }

        return {
            itemCount: rows.length,
            lowStockCount,
            stockTrackedCount,
            totalStockUnits,
            rows,
        };
    }

    async getSalesReport(ctx: RequestContext, fromDate?: string, toDate?: string): Promise<unknown> {
        const todayIso = new Date().toISOString().slice(0, 10);
        const fromStr = fromDate || todayIso;
        const toStr = toDate || fromStr;
        const fromDt = parseFlexDate(fromStr, false) ?? parseFlexDate(todayIso, false)!;
        const toDt = parseFlexDate(toStr, true) ?? parseFlexDate(todayIso, true)!;

        const repo = this.connection.getRepository(ctx, PharmaSale);
        // Filter by createdAt (datetime) — billDate is a varchar in user-supplied dd/mm/yyyy
        // format, which made string Between unreliable. createdAt is reliable and indexed.
        const bills = await repo.find({
            where: { createdAt: Between(fromDt, toDt) } as any,
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });

        const num = (v: unknown): number => parseFloat(String(v ?? 0)) || 0;
        let totalAmount = 0,
            cashTotal = 0,
            upiTotal = 0,
            cardTotal = 0,
            chequeTotal = 0,
            onlineTotal = 0,
            creditTotal = 0,
            balanceDueTotal = 0,
            discountTotal = 0,
            taxTotal = 0;
        for (const b of bills) {
            totalAmount += num(b.grandTotal);
            cashTotal += num(b.cashAmount);
            upiTotal += num(b.upiAmount);
            cardTotal += num(b.cardAmount);
            chequeTotal += num(b.chequeAmount);
            onlineTotal += num(b.onlineAmount);
            const balance = num(b.balanceDue);
            balanceDueTotal += balance;
            if (String(b.saleType).toUpperCase() === 'CREDIT') {
                creditTotal += num(b.grandTotal);
            }
            discountTotal += num(b.discount);
            taxTotal += num(b.taxAmount);
        }

        return {
            fromDate: fromStr,
            toDate: toStr,
            billCount: bills.length,
            totalAmount,
            cashTotal,
            upiTotal,
            cardTotal,
            chequeTotal,
            onlineTotal,
            creditTotal,
            balanceDueTotal,
            discountTotal,
            taxTotal,
            bills,
        };
    }

    // ═════════════════════════════════════════════════════════════
    // NEW FLOWS BELOW — all use `connection.withTransaction` where they
    // touch multiple rows, throw on negative-stock, and use soft delete.
    // ═════════════════════════════════════════════════════════════

    // ───────────── POS UNIT ─────────────
    async listUnits(ctx: RequestContext): Promise<PosUnit[]> {
        // Trigger idempotent seed so the very first call returns a populated list,
        // not an empty one (which previously made callers think KG etc. weren't seeded).
        await this.ensureSeedUnits(ctx);
        return this.connection.getRepository(ctx, PosUnit).find({
            where: { status: 'ACTIVE' },
            order: { code: 'ASC' },
            take: MAX_LIST,
        });
    }

    async createUnit(ctx: RequestContext, input: CreatePosUnitInput): Promise<PosUnit> {
        const repo = this.connection.getRepository(ctx, PosUnit);
        const dup = await repo.findOne({ where: { code: input.code, status: 'ACTIVE' } });
        if (dup) throw new UserInputError(`Unit code "${input.code}" already exists.`);
        const unit = new PosUnit({
            code: input.code,
            name: input.name,
            symbol: input.symbol || '',
            status: 'ACTIVE',
        });
        return repo.save(unit);
    }

    async updateUnit(
        ctx: RequestContext,
        id: number | string,
        input: Partial<CreatePosUnitInput>,
    ): Promise<PosUnit> {
        const repo = this.connection.getRepository(ctx, PosUnit);
        const unit = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!unit) throw new UserInputError('Unit not found.');
        Object.assign(unit, input);
        return repo.save(unit);
    }

    async cancelUnit(ctx: RequestContext, id: number | string): Promise<PosUnit> {
        const repo = this.connection.getRepository(ctx, PosUnit);
        const unit = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!unit) throw new UserInputError('Unit not found.');
        unit.status = 'CANCELLED';
        return repo.save(unit);
    }

    // ───────────── POS ITEM PRICE TIER ─────────────
    async listItemPriceTiers(ctx: RequestContext, itemId: number | string): Promise<PosItemPriceTier[]> {
        return this.connection.getRepository(ctx, PosItemPriceTier).find({
            where: {
                itemId: typeof itemId === 'string' ? parseInt(itemId, 10) : itemId,
                status: 'ACTIVE',
            },
            order: { tierType: 'ASC', minQty: 'ASC' },
            take: MAX_LIST,
        });
    }

    async createItemPriceTier(
        ctx: RequestContext,
        input: CreatePosItemPriceTierInput,
    ): Promise<PosItemPriceTier> {
        const itemRepo = this.connection.getRepository(ctx, PharmaItem);
        const item = await itemRepo.findOne({ where: { id: input.itemId } as any });
        if (!item) throw new UserInputError(`Item id=${input.itemId} not found.`);
        if (input.tierType === 'WHOLESALE' && (!input.minQty || input.minQty <= 0)) {
            throw new UserInputError('Wholesale tier requires minQty > 0.');
        }
        const tier = new PosItemPriceTier({
            itemId: input.itemId,
            tierType: input.tierType,
            label: input.label || '',
            rate: input.rate,
            minQty: input.minQty || 0,
            taxMode: input.taxMode || 'Without Tax',
            discountPct: input.discountPct || 0,
            discountFlat: input.discountFlat || 0,
            discountType: input.discountType || 'Percentage',
            status: 'ACTIVE',
        });
        return this.connection.getRepository(ctx, PosItemPriceTier).save(tier);
    }

    async updateItemPriceTier(
        ctx: RequestContext,
        id: number | string,
        input: Partial<CreatePosItemPriceTierInput>,
    ): Promise<PosItemPriceTier> {
        const repo = this.connection.getRepository(ctx, PosItemPriceTier);
        const tier = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!tier) throw new UserInputError('Price tier not found.');
        Object.assign(tier, input);
        return repo.save(tier);
    }

    async cancelItemPriceTier(ctx: RequestContext, id: number | string): Promise<PosItemPriceTier> {
        const repo = this.connection.getRepository(ctx, PosItemPriceTier);
        const tier = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!tier) throw new UserInputError('Price tier not found.');
        tier.status = 'CANCELLED';
        return repo.save(tier);
    }

    // ───────────── POS STOCK ADJUSTMENT ─────────────
    async listStockAdjustments(ctx: RequestContext): Promise<PosStockAdjustment[]> {
        return this.connection.getRepository(ctx, PosStockAdjustment).find({
            where: { status: 'ACTIVE' },
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async createStockAdjustment(
        ctx: RequestContext,
        input: CreatePosStockAdjustmentInput,
    ): Promise<PosStockAdjustment> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const item = await itemRepo.findOne({ where: { code: input.itemCode } });
            if (!item) throw new UserInputError(`Item with code "${input.itemCode}" not found.`);

            const delta = Math.abs(Number(input.adjustQty) || 0);
            const sign = input.adjType === 'ADD' ? +1 : -1;
            const refType = input.adjType === 'ADD' ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_REMOVE';

            const record = new PosStockAdjustment({
                adjNo: input.adjNo,
                adjDate: input.adjDate,
                itemCode: input.itemCode,
                previousQty: 0,
                adjustQty: delta,
                resultingQty: 0,
                adjType: input.adjType,
                atPrice: input.atPrice || 0,
                reason: input.reason || '',
                details: input.details || '',
                status: 'ACTIVE',
                createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
            const saved = await this.connection.getRepository(tCtx, PosStockAdjustment).save(record);

            const { previousBalance, runningBalance } = await this.writeLedger(
                tCtx,
                item,
                refType,
                Number(saved.id),
                saved.adjNo,
                sign * delta,
                (input as any).unit,
                saved.adjDate,
                saved.reason || `Adjustment ${saved.adjNo}`,
            );
            saved.previousQty = previousBalance;
            saved.resultingQty = runningBalance;
            return this.connection.getRepository(tCtx, PosStockAdjustment).save(saved);
        });
    }

    async cancelStockAdjustment(ctx: RequestContext, id: number | string): Promise<PosStockAdjustment> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosStockAdjustment);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const record = await repo.findOne({
                where: {
                    id: typeof id === 'string' ? parseInt(id, 10) : id,
                    status: 'ACTIVE',
                } as any,
            });
            if (!record) throw new UserInputError('Active stock adjustment not found.');

            const item = await itemRepo.findOne({ where: { code: record.itemCode } });
            if (item) {
                const reverseSign = record.adjType === 'ADD' ? -1 : +1;
                await this.writeLedger(
                    tCtx,
                    item,
                    'ADJUSTMENT_CANCEL',
                    Number(record.id),
                    record.adjNo,
                    reverseSign * record.adjustQty,
                    item.unit,
                    new Date().toISOString().slice(0, 10),
                    `Cancel adjustment ${record.adjNo}`,
                );
            }

            record.status = 'CANCELLED';
            return repo.save(record);
        });
    }

    // ───────────── POS PURCHASE RETURN ─────────────
    async listPurchaseReturns(ctx: RequestContext): Promise<PosPurchaseReturn[]> {
        return this.connection.getRepository(ctx, PosPurchaseReturn).find({
            where: { status: 'ACTIVE' },
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async createPurchaseReturn(
        ctx: RequestContext,
        input: CreatePosPurchaseReturnInput,
    ): Promise<PosPurchaseReturn> {
        // M4 — Mandatory supplier + duplicate retNo guard at the top.
        if (!input.supplier || !String(input.supplier).trim()) {
            throw new UserInputError('Supplier is required for Purchase Return.');
        }
        if (!input.retNo || !String(input.retNo).trim()) {
            throw new UserInputError('Return Number is required.');
        }
        // Fix 3 — originalPurchaseId mandatory. Free-form returns are unsafe
        // (no per-item qty cap, no original-rate enforcement) and so are
        // refused at the service layer regardless of client framing.
        if (input.originalPurchaseId == null) {
            throw new UserInputError(
                'originalPurchaseId is required. Free-form Purchase Returns are not allowed — pick a source bill via searchPurchasesForReturn.',
            );
        }

        const validatedRows = await this.validateAndSnapshotPurchaseRows(ctx, input.rows, 'Purchase Return');

        return this.connection.withTransaction(ctx, async tCtx => {
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const purchaseRepo = this.connection.getRepository(tCtx, PharmaPurchase);
            const retRepo = this.connection.getRepository(tCtx, PosPurchaseReturn);

            // M4 — Duplicate retNo guard
            const dup = await retRepo.findOne({ where: { retNo: String(input.retNo).trim() } });
            if (dup) throw new UserInputError(`Return Number "${input.retNo}" already used.`);

            // M4 — If originalPurchaseId is set, force puRate from that purchase
            // and cap returnQty <= originalQty - prior-returned qty per itemCode.
            let rows = validatedRows;
            let origPurchaseRow: PharmaPurchase | null = null;
            if (input.originalPurchaseId != null) {
                const origPurchase = await purchaseRepo.findOne({
                    where: { id: Number(input.originalPurchaseId) } as any,
                });
                origPurchaseRow = origPurchase;
                if (!origPurchase) {
                    throw new UserInputError(
                        `Original purchase id=${input.originalPurchaseId} not found.`,
                    );
                }
                const origRows: PurchaseRowInput[] = (() => {
                    try { return JSON.parse(origPurchase.rowsJson || '[]') || []; } catch { return []; }
                })();
                const origMap = new Map<string, { puRate: number; qty: number }>();
                for (const oRow of origRows) {
                    const c = String(oRow.itemCode || oRow.code || '').trim();
                    if (!c) continue;
                    origMap.set(c, {
                        puRate: Number(oRow.puRate) || 0,
                        qty: (Number(oRow.qty) || 0) + (Number(oRow.freeQty) || 0),
                    });
                }
                // Aggregate prior active returns from same originalPurchaseId.
                const priorReturns = await retRepo.find({
                    where: { originalPurchaseId: Number(input.originalPurchaseId), status: 'ACTIVE' } as any,
                });
                const returnedMap = new Map<string, number>();
                for (const r of priorReturns) {
                    const rrows: any[] = (() => {
                        try { return JSON.parse(r.rowsJson || '[]') || []; } catch { return []; }
                    })();
                    for (const rr of rrows) {
                        const c = String(rr.itemCode || rr.code || '').trim();
                        if (!c) continue;
                        const used = (Number(rr.qty) || 0) + (Number(rr.freeQty) || 0);
                        returnedMap.set(c, (returnedMap.get(c) || 0) + used);
                    }
                }
                rows = validatedRows.map(r => {
                    const c = String(r.itemCode || r.code || '').trim();
                    const orig = origMap.get(c);
                    if (!orig) {
                        throw new UserInputError(
                            `Item "${c}" was not on original purchase id=${input.originalPurchaseId}.`,
                        );
                    }
                    const requested = (Number(r.qty) || 0) + (Number(r.freeQty) || 0);
                    const remaining = orig.qty - (returnedMap.get(c) || 0);
                    if (requested > remaining) {
                        throw new UserInputError(
                            `Cannot return ${requested} of "${c}" — only ${remaining} of ${orig.qty} remaining (qty already returned: ${returnedMap.get(c) || 0}).`,
                        );
                    }
                    return { ...r, puRate: orig.puRate, amount: requested * orig.puRate };
                });
            }

            const record = new PosPurchaseReturn({
                retNo: String(input.retNo).trim(),
                retDate: input.retDate,
                originalPurchaseId: input.originalPurchaseId ?? null,
                supplier: String(input.supplier).trim(),
                supplierGstin: origPurchaseRow?.supplierGstin || '',
                placeOfSupply: origPurchaseRow?.placeOfSupply || '',
                address: input.address || '',
                rowsJson: JSON.stringify(rows),
                totalAmount: input.totalAmount || 0,
                totalDisc: input.totalDisc || 0,
                totalTax: input.totalTax || 0,
                netAmount: input.netAmount || 0,
                reason: input.reason || '',
                status: 'ACTIVE',
                createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
            const saved = await retRepo.save(record);

            // Decrement stock per row via writeLedger (negative-stock guarded inside).
            for (const row of rows) {
                const code = row.itemCode || row.code;
                if (!code) continue;
                const qty = parseFloat(String(row.qty ?? 0)) || 0;
                const freeQty = parseFloat(String(row.freeQty ?? 0)) || 0;
                const delta = qty + freeQty;
                if (delta <= 0) continue;
                const item = await itemRepo.findOne({ where: { code: String(code) } });
                if (!item || !item.isStockBased) continue;
                await this.writeLedger(
                    tCtx,
                    item,
                    'PURCHASE_RETURN',
                    Number(saved.id),
                    saved.retNo,
                    -delta,
                    row.unit,
                    saved.retDate,
                    saved.reason || `Purchase return ${saved.retNo}`,
                );
            }

            return saved;
        });
    }

    async cancelPurchaseReturn(
        ctx: RequestContext,
        id: number | string,
    ): Promise<PosPurchaseReturn> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosPurchaseReturn);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const record = await repo.findOne({
                where: {
                    id: typeof id === 'string' ? parseInt(id, 10) : id,
                    status: 'ACTIVE',
                } as any,
            });
            if (!record) throw new UserInputError('Active purchase return not found.');

            const rows: PurchaseRowInput[] = (() => {
                try {
                    return JSON.parse(record.rowsJson || '[]') || [];
                } catch {
                    return [];
                }
            })();
            for (const row of rows) {
                const code = row.itemCode || row.code;
                if (!code) continue;
                const qty = parseFloat(String(row.qty ?? 0)) || 0;
                const freeQty = parseFloat(String(row.freeQty ?? 0)) || 0;
                const delta = qty + freeQty;
                if (delta <= 0) continue;
                const item = await itemRepo.findOne({ where: { code: String(code) } });
                if (!item || !item.isStockBased) continue;
                await this.writeLedger(
                    tCtx,
                    item,
                    'PURCHASE_RETURN_CANCEL',
                    Number(record.id),
                    record.retNo,
                    +delta,
                    row.unit,
                    new Date().toISOString().slice(0, 10),
                    `Cancel purchase return ${record.retNo}`,
                );
            }

            record.status = 'CANCELLED';
            return repo.save(record);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // M4 — Sales Return (greenfield) + Purchase Return upgrades
    //
    // SALES RETURN:
    //   - Customer picks a bill from a list (pharmaSalesByCustomer)
    //   - UI loads the bill (getSaleForReturn) with remainingQty per item
    //   - createSalesReturn enforces returnQty <= remaining and FREEZES rate
    //     from the original invoice (client rate is ignored).
    //   - Stock INCREASES via writeLedger('SALE_RETURN', +qty).
    //   - Original PharmaSale is NEVER mutated (frozen invoice rule).
    //   - Customer balance impact is posted via a negative PharmaReceipt.
    //
    // PURCHASE RETURN:
    //   - createPurchaseReturn now forces puRate from originalPurchaseId.
    //   - Caps returnQty <= original purchased qty minus prior returns.
    //   - Duplicate retNo guard.
    //   - searchPurchasesForReturn helps the UI pick from.
    // ═══════════════════════════════════════════════════════════════════════

    async listSalesByCustomer(
        ctx: RequestContext,
        opts: { customerPhone?: string; customerName?: string; limit?: number },
    ): Promise<PharmaSale[]> {
        const repo = this.connection.getRepository(ctx, PharmaSale);
        const qb = repo
            .createQueryBuilder('s')
            .where('s.status = :status', { status: 'ACTIVE' })
            .orderBy('s.createdAt', 'DESC')
            .limit(Math.min(opts.limit || 100, MAX_LIST));
        if (opts.customerPhone) {
            qb.andWhere('s.customerPhone = :phone', { phone: opts.customerPhone });
        } else if (opts.customerName) {
            qb.andWhere('LOWER(s.customerName) LIKE :name', {
                name: `%${opts.customerName.toLowerCase()}%`,
            });
        } else {
            throw new UserInputError('Provide customerPhone or customerName.');
        }
        return qb.getMany();
    }

    /**
     * Returns the original sale's items enriched with `alreadyReturned` and
     * `remainingQty` (per itemCode) so the return UI can guard at row-level.
     */
    async getSaleForReturn(ctx: RequestContext, saleId: number | string): Promise<unknown> {
        const saleRepo = this.connection.getRepository(ctx, PharmaSale);
        const retRepo = this.connection.getRepository(ctx, PosSalesReturn);
        const sale = await saleRepo.findOne({
            where: { id: typeof saleId === 'string' ? parseInt(saleId, 10) : saleId } as any,
        });
        if (!sale) throw new UserInputError('Sale not found.');
        if (sale.status === 'CANCELLED') {
            throw new UserInputError('Cannot return a cancelled sale.');
        }

        const originalItems: SaleRowInput[] = (() => {
            try { return JSON.parse(sale.itemsJson || '[]') || []; } catch { return []; }
        })();

        // Aggregate prior return qty per itemCode for this sale.
        const priorReturns = await retRepo.find({
            where: { originalSaleId: Number(sale.id), status: 'ACTIVE' } as any,
        });
        const returnedMap = new Map<string, number>();
        for (const r of priorReturns) {
            const rrows: any[] = (() => {
                try { return JSON.parse(r.rowsJson || '[]') || []; } catch { return []; }
            })();
            for (const rr of rrows) {
                const code = String(rr.itemCode || rr.code || '').trim();
                if (!code) continue;
                returnedMap.set(code, (returnedMap.get(code) || 0) + (Number(rr.returnQty) || 0));
            }
        }

        const items = originalItems.map(r => {
            const code = String((r as any).code || (r as any).itemCode || '').trim();
            const originalQty = Number((r as any).qty) || 0;
            const alreadyReturned = returnedMap.get(code) || 0;
            const rate =
                Number((r as any).rate) ||
                Number((r as any).salesRate) ||
                Number((r as any).saleRate) || 0;
            const gstPercent = Number((r as any).gstPercent) || 0;
            return {
                itemCode: code,
                itemName: String((r as any).itemName || ''),
                hsnCode: String((r as any).hsnCode || ''),
                originalQty,
                alreadyReturned,
                remainingQty: Math.max(0, originalQty - alreadyReturned),
                originalSalesRate: rate,
                mrpRate: Number((r as any).mrpRate) || 0,
                // GST treatment is inherited from the original sale line. The
                // inclusive/exclusive flag and slab were already stored per item at
                // bill time — the return mirrors them, never recomputes from scratch.
                gstPercent,
                taxPct: gstPercent, // back-compat alias (the old `taxPct` key never existed → always 0)
                priceInclusive: Boolean((r as any).priceInclusive),
                interState: Boolean((r as any).interState),
                // Original (full-qty) GST breakup — prorated by returnQty on the return.
                origTaxable: Number((r as any).taxableAmount) || 0,
                origCgst: Number((r as any).cgstAmount) || 0,
                origSgst: Number((r as any).sgstAmount) || 0,
                origIgst: Number((r as any).igstAmount) || 0,
                origCess: Number((r as any).cessAmount) || 0,
                origTaxAmount: Number((r as any).taxAmount) || 0,
                origLineTotal: Number((r as any).lineTotal) || 0,
                unit: String((r as any).unit || ''),
            };
        });

        return {
            id: sale.id,
            billNo: sale.billNo,
            billDate: sale.billDate,
            customerName: sale.customerName,
            customerPhone: sale.customerPhone,
            grandTotal: sale.grandTotal,
            balanceDue: sale.balanceDue,
            items,
        };
    }

    // ───────────── POS SALES RETURN ─────────────
    async listSalesReturns(
        ctx: RequestContext,
        opts: { originalSaleId?: number; customerPhone?: string; includeCancelled?: boolean } = {},
    ): Promise<PosSalesReturn[]> {
        const repo = this.connection.getRepository(ctx, PosSalesReturn);
        const where: any = {};
        if (!opts.includeCancelled) where.status = 'ACTIVE';
        if (opts.originalSaleId != null) where.originalSaleId = opts.originalSaleId;
        if (opts.customerPhone) where.customerPhone = opts.customerPhone;
        return repo.find({ where, order: { createdAt: 'DESC' }, take: MAX_LIST });
    }

    async createSalesReturn(
        ctx: RequestContext,
        input: {
            retNo: string;
            retDate: string;
            retTime?: string;
            originalSaleId: number;
            reason?: string;
            remarks?: string;
            rows: Array<{ itemCode: string; itemName?: string; returnQty: number; taxAmount?: number }>;
        },
    ): Promise<PosSalesReturn> {
        if (!input.retNo || !String(input.retNo).trim()) {
            throw new UserInputError('Return Number is required.');
        }
        if (!input.retDate || !String(input.retDate).trim()) {
            throw new UserInputError('Return Date is required.');
        }
        if (input.originalSaleId == null) {
            throw new UserInputError('originalSaleId is required.');
        }
        if (!input.rows || input.rows.length === 0) {
            throw new UserInputError('Sales Return requires at least one item row.');
        }

        return this.connection.withTransaction(ctx, async tCtx => {
            const saleRepo = this.connection.getRepository(tCtx, PharmaSale);
            const retRepo = this.connection.getRepository(tCtx, PosSalesReturn);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const receiptRepo = this.connection.getRepository(tCtx, PharmaReceipt);

            // Duplicate retNo guard
            const dup = await retRepo.findOne({ where: { retNo: String(input.retNo).trim() } });
            if (dup) throw new UserInputError(`Return Number "${input.retNo}" already used.`);

            const sale = await saleRepo.findOne({ where: { id: input.originalSaleId } as any });
            if (!sale) throw new UserInputError('Original sale not found.');
            if (sale.status === 'CANCELLED') {
                throw new UserInputError('Cannot return a cancelled sale.');
            }

            // Build remainingQty map from original sale items + prior active returns.
            const detail = (await this.getSaleForReturn(tCtx, sale.id)) as any;
            const remainingMap = new Map<string, {
                remaining: number; originalQty: number; originalRate: number; itemName: string;
                hsnCode: string; unit: string; gstPercent: number; priceInclusive: boolean; interState: boolean;
                origTaxable: number; origCgst: number; origSgst: number; origIgst: number;
                origCess: number; origTaxAmount: number; origLineTotal: number;
            }>();
            for (const it of detail.items as any[]) {
                remainingMap.set(it.itemCode, {
                    remaining: Number(it.remainingQty) || 0,
                    originalQty: Number(it.originalQty) || 0,
                    originalRate: Number(it.originalSalesRate) || 0,
                    itemName: String(it.itemName || ''),
                    hsnCode: String(it.hsnCode || ''),
                    unit: String(it.unit || ''),
                    gstPercent: Number(it.gstPercent) || 0,
                    priceInclusive: Boolean(it.priceInclusive),
                    interState: Boolean(it.interState),
                    origTaxable: Number(it.origTaxable) || 0,
                    origCgst: Number(it.origCgst) || 0,
                    origSgst: Number(it.origSgst) || 0,
                    origIgst: Number(it.origIgst) || 0,
                    origCess: Number(it.origCess) || 0,
                    origTaxAmount: Number(it.origTaxAmount) || 0,
                    origLineTotal: Number(it.origLineTotal) || 0,
                });
            }

            // Snapshot rows — the GST breakup is PRORATED from the original sale line by
            // (returnQty / originalQty), so the inclusive/exclusive treatment, slab and
            // rounding exactly mirror the original invoice (no recompute, no double-count).
            // Reject if returnQty > remaining.
            let totalAmount = 0; // taxable base
            let totalTax = 0;
            const enrichedRows: any[] = [];
            for (let i = 0; i < input.rows.length; i++) {
                const r = input.rows[i];
                const code = String(r.itemCode || '').trim();
                if (!code) throw new UserInputError(`Row #${i + 1}: itemCode required.`);
                const remainingInfo = remainingMap.get(code);
                if (!remainingInfo) {
                    throw new UserInputError(
                        `Row #${i + 1}: item "${code}" was not on the original sale.`,
                    );
                }
                const qty = Number(r.returnQty) || 0;
                if (qty <= 0) throw new UserInputError(`Row #${i + 1}: returnQty must be > 0.`);
                if (qty > remainingInfo.remaining) {
                    throw new UserInputError(
                        `Row #${i + 1} ("${remainingInfo.itemName}"): cannot return ${qty} (only ${remainingInfo.remaining} remaining).`,
                    );
                }
                // Proportion of the original line being returned (per-unit faithful).
                const f = remainingInfo.originalQty > 0 ? qty / remainingInfo.originalQty : 0;
                const lineTaxable = round2(remainingInfo.origTaxable * f);
                const lineCgst = round2(remainingInfo.origCgst * f);
                const lineSgst = round2(remainingInfo.origSgst * f);
                const lineIgst = round2(remainingInfo.origIgst * f);
                const lineCess = round2(remainingInfo.origCess * f);
                const lineTax = round2(remainingInfo.origTaxAmount * f);
                const lineTotal = round2(remainingInfo.origLineTotal * f);
                totalAmount += lineTaxable;
                totalTax += lineTax;
                enrichedRows.push({
                    itemCode: code,
                    itemName: r.itemName || remainingInfo.itemName,
                    hsnCode: remainingInfo.hsnCode,
                    unit: remainingInfo.unit,
                    qty, // parseGstLines (GST HSN summary) reads `qty`
                    returnQty: qty,
                    originalSalesRate: remainingInfo.originalRate,
                    gstPercent: remainingInfo.gstPercent,
                    taxPct: remainingInfo.gstPercent, // back-compat alias
                    priceInclusive: remainingInfo.priceInclusive,
                    interState: remainingInfo.interState,
                    taxableAmount: lineTaxable,
                    cgstAmount: lineCgst,
                    sgstAmount: lineSgst,
                    igstAmount: lineIgst,
                    cessAmount: lineCess,
                    taxAmount: lineTax,
                    lineTotal,
                });
            }
            const netAmount = round2(totalAmount + totalTax);

            const record = new PosSalesReturn({
                retNo: String(input.retNo).trim(),
                retDate: input.retDate,
                retTime: input.retTime || '',
                originalSaleId: Number(sale.id),
                originalBillNo: sale.billNo,
                customerName: sale.customerName,
                customerPhone: sale.customerPhone,
                customerAddress: sale.customerAddress,
                customerGstin: sale.customerGstin || '',
                placeOfSupply: sale.placeOfSupply || '',
                rowsJson: JSON.stringify(enrichedRows),
                totalAmount,
                totalTax,
                totalDisc: 0,
                netAmount,
                reason: input.reason || '',
                remarks: input.remarks || '',
                status: 'ACTIVE',
                createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
            const saved = await retRepo.save(record);

            // Stock IN per row via writeLedger (the +ve direction).
            for (const r of enrichedRows) {
                const item = await itemRepo.findOne({ where: { code: r.itemCode } });
                if (!item || !item.isStockBased) continue;
                await this.writeLedger(
                    tCtx,
                    item,
                    'SALE_RETURN',
                    Number(saved.id),
                    saved.retNo,
                    +r.returnQty,
                    item.unit,
                    saved.retDate,
                    saved.reason || `Sales return ${saved.retNo}`,
                );
            }

            // Customer-balance impact: post a negative receipt linked to the return.
            // Original sale is left immutable.
            if (netAmount > 0 && sale.customerName) {
                await receiptRepo.save(
                    new PharmaReceipt({
                        docNo: `SR-RCPT-${saved.retNo}`,
                        docDate: saved.retDate,
                        billRefNo: sale.billNo,
                        docType: 'SALES_RETURN',
                        refType: 'SALES_RETURN',
                        accHead: sale.customerName,
                        amount: -netAmount,
                        recAmount: -netAmount,
                        rowsJson: JSON.stringify([{ retId: saved.id, retNo: saved.retNo, netAmount }]),
                    } as any),
                );
            }

            // C1 fix — update the customer Ledger so balance reflects the return.
            // Pessimistic lock prevents lost-update under concurrent payments/returns.
            // If no matching Ledger row found (CASH sale / anonymous walk-in),
            // we safely no-op — the negative PharmaReceipt above is the audit trail.
            if (netAmount > 0) {
                const ledgerRepo = this.connection.getRepository(tCtx, Ledger);
                const ledger = await ledgerRepo
                    .createQueryBuilder('l')
                    .setLock('pessimistic_write')
                    .where('l.type = :type', { type: 'CUSTOMER' })
                    .andWhere('l.invoiceNumber = :inv', { inv: sale.billNo })
                    .getOne();
                if (ledger) {
                    const newAmount = Math.max(0, Number(ledger.amount) - Math.round(netAmount));
                    const newBalance = Math.max(0, newAmount - Number(ledger.paidAmount));
                    ledger.amount = newAmount;
                    ledger.balance = newBalance;
                    ledger.status =
                        newBalance === 0
                            ? 'FULLY_PAID'
                            : Number(ledger.paidAmount) > 0
                                ? 'PARTIALLY_PAID'
                                : 'PENDING';
                    await ledgerRepo.save(ledger);
                    // Idempotency flag — ledger impact is now applied for this return.
                    saved.ledgerApplied = true;
                    await retRepo.save(saved);
                }
            }

            return saved;
        });
    }

    async cancelSalesReturn(
        ctx: RequestContext,
        id: number | string,
        reason?: string,
    ): Promise<PosSalesReturn> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosSalesReturn);
            const itemRepo = this.connection.getRepository(tCtx, PharmaItem);
            const record = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id, status: 'ACTIVE' } as any,
            });
            if (!record) throw new UserInputError('Active sales return not found.');

            const rows: any[] = (() => {
                try { return JSON.parse(record.rowsJson || '[]') || []; } catch { return []; }
            })();
            for (const r of rows) {
                const code = String(r.itemCode || '').trim();
                if (!code) continue;
                const qty = Number(r.returnQty) || 0;
                if (qty <= 0) continue;
                const item = await itemRepo.findOne({ where: { code } });
                if (!item || !item.isStockBased) continue;
                await this.writeLedger(
                    tCtx,
                    item,
                    'SALE_RETURN_CANCEL',
                    Number(record.id),
                    record.retNo,
                    -qty,
                    item.unit,
                    new Date().toISOString().slice(0, 10),
                    reason || `Cancel sales return ${record.retNo}`,
                );
            }

            // C1 fix — undo the Ledger amount reduction we did on createSalesReturn.
            // Same pessimistic lock + safe no-op if no ledger row (CASH sale).
            const cancelNetAmount = Number(record.netAmount) || 0;
            if (cancelNetAmount > 0 && record.originalBillNo) {
                const ledgerRepo = this.connection.getRepository(tCtx, Ledger);
                const ledger = await ledgerRepo
                    .createQueryBuilder('l')
                    .setLock('pessimistic_write')
                    .where('l.type = :type', { type: 'CUSTOMER' })
                    .andWhere('l.invoiceNumber = :inv', { inv: record.originalBillNo })
                    .getOne();
                if (ledger) {
                    const newAmount = Number(ledger.amount) + Math.round(cancelNetAmount);
                    const newBalance = Math.max(0, newAmount - Number(ledger.paidAmount));
                    ledger.amount = newAmount;
                    ledger.balance = newBalance;
                    ledger.status =
                        newBalance === 0
                            ? 'FULLY_PAID'
                            : Number(ledger.paidAmount) > 0
                                ? 'PARTIALLY_PAID'
                                : 'PENDING';
                    await ledgerRepo.save(ledger);
                    // Reset idempotency flag — ledger impact has been reversed.
                    record.ledgerApplied = false;
                }
            }

            record.status = 'CANCELLED';
            record.cancelledAt = new Date();
            record.cancelledByAdminId = ctx.activeUserId != null ? Number(ctx.activeUserId) : null;
            record.cancelReason = reason || '';
            return repo.save(record);
        });
    }

    /**
     * Cleanup — applies the missing ledger reductions for ACTIVE PosSalesReturn
     * rows that were created BEFORE the C1 fix shipped. Idempotent via the
     * `ledgerApplied` flag. Re-runs are safe — the filter excludes rows
     * already processed.
     *
     * - Transaction-safe: entire walk wrapped in `withTransaction`.
     * - Concurrency-safe: per-ledger `pessimistic_write` lock prevents races
     *   with concurrent `addPayment` or `createSalesReturn` mutations on the
     *   same Ledger row.
     * - SuperAdmin-only at the resolver layer.
     */
    async reconcileSalesReturnsToLedger(ctx: RequestContext): Promise<unknown> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const retRepo = this.connection.getRepository(tCtx, PosSalesReturn);
            const ledgerRepo = this.connection.getRepository(tCtx, Ledger);
            const candidates = await retRepo.find({
                where: { status: 'ACTIVE', ledgerApplied: false } as any,
                order: { createdAt: 'ASC' },
            });
            const corrections: unknown[] = [];
            let updated = 0;
            let skipped = 0;
            for (const ret of candidates) {
                const netAmount = Number(ret.netAmount) || 0;
                if (netAmount <= 0 || !ret.originalBillNo) {
                    // Nothing to apply for this row; mark as done so future runs skip it.
                    ret.ledgerApplied = true;
                    await retRepo.save(ret);
                    skipped++;
                    continue;
                }
                const ledger = await ledgerRepo
                    .createQueryBuilder('l')
                    .setLock('pessimistic_write')
                    .where('l.type = :type', { type: 'CUSTOMER' })
                    .andWhere('l.invoiceNumber = :inv', { inv: ret.originalBillNo })
                    .getOne();
                if (!ledger) {
                    // CASH sale / anonymous — no ledger row to update. Mark done.
                    ret.ledgerApplied = true;
                    await retRepo.save(ret);
                    skipped++;
                    continue;
                }
                const beforeAmount = Number(ledger.amount) || 0;
                const beforeBalance = Number(ledger.balance) || 0;
                const newAmount = Math.max(0, beforeAmount - Math.round(netAmount));
                const newBalance = Math.max(0, newAmount - Number(ledger.paidAmount));
                ledger.amount = newAmount;
                ledger.balance = newBalance;
                ledger.status =
                    newBalance === 0
                        ? 'FULLY_PAID'
                        : Number(ledger.paidAmount) > 0
                            ? 'PARTIALLY_PAID'
                            : 'PENDING';
                await ledgerRepo.save(ledger);
                ret.ledgerApplied = true;
                await retRepo.save(ret);
                corrections.push({
                    ledgerId: ledger.id,
                    returnId: ret.id,
                    retNo: ret.retNo,
                    beforeAmount,
                    beforeBalance,
                    afterAmount: newAmount,
                    afterBalance: newBalance,
                    deltaApplied: Math.round(netAmount),
                });
                updated++;
            }
            return {
                totalReturns: candidates.length,
                updated,
                skipped,
                corrections,
            };
        });
    }

    // ───────────── Purchase Return upgrades (M4) ─────────────
    async searchPurchasesForReturn(
        ctx: RequestContext,
        opts: { supplier?: string; itemCode?: string; fromDate?: string; toDate?: string; limit?: number },
    ): Promise<PharmaPurchase[]> {
        const repo = this.connection.getRepository(ctx, PharmaPurchase);
        const qb = repo
            .createQueryBuilder('p')
            .where('p.status = :status', { status: 'ACTIVE' })
            .orderBy('p.createdAt', 'DESC')
            .limit(Math.min(opts.limit || 100, MAX_LIST));
        if (opts.supplier) qb.andWhere('LOWER(p.supplier) LIKE :supp', { supp: `%${opts.supplier.toLowerCase()}%` });
        if (opts.itemCode) qb.andWhere('p.rowsJson LIKE :code', { code: `%${opts.itemCode}%` });
        const fromDt = parseFlexDate(opts.fromDate, false);
        const toDt = parseFlexDate(opts.toDate, true);
        if (fromDt) qb.andWhere('p.createdAt >= :from', { from: fromDt });
        if (toDt) qb.andWhere('p.createdAt <= :to', { to: toDt });
        return qb.getMany();
    }
    async listPurchaseOrders(
        ctx: RequestContext,
        status?: PurchaseOrderStatus,
    ): Promise<PosPurchaseOrder[]> {
        const where = status ? { status } : { status: 'OPEN' as PurchaseOrderStatus };
        return this.connection.getRepository(ctx, PosPurchaseOrder).find({
            where: where as any,
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async getPurchaseOrder(
        ctx: RequestContext,
        id: number | string,
    ): Promise<PosPurchaseOrder | null> {
        return this.connection.getRepository(ctx, PosPurchaseOrder).findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
    }

    async createPurchaseOrder(
        ctx: RequestContext,
        input: CreatePosPurchaseOrderInput,
    ): Promise<PosPurchaseOrder> {
        const repo = this.connection.getRepository(ctx, PosPurchaseOrder);
        const po = new PosPurchaseOrder({
            poNo: input.poNo,
            poDate: input.poDate,
            expectedDate: input.expectedDate || '',
            supplier: input.supplier || '',
            address: input.address || '',
            rowsJson: JSON.stringify(input.rows || []),
            status: 'OPEN',
            convertedPurchaseId: null,
            totalAmount: input.totalAmount || 0,
            netAmount: input.netAmount || 0,
            remarks: input.remarks || '',
            createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
        });
        return repo.save(po);
    }

    async updatePurchaseOrder(
        ctx: RequestContext,
        id: number | string,
        input: Partial<CreatePosPurchaseOrderInput>,
    ): Promise<PosPurchaseOrder> {
        const repo = this.connection.getRepository(ctx, PosPurchaseOrder);
        const po = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!po) throw new UserInputError('Purchase order not found.');
        if (po.status !== 'OPEN') {
            throw new UserInputError(`Cannot update PO in status "${po.status}".`);
        }
        if (input.rows !== undefined) po.rowsJson = JSON.stringify(input.rows);
        const { rows: _ignored, ...rest } = input;
        Object.assign(po, rest);
        return repo.save(po);
    }

    async cancelPurchaseOrder(
        ctx: RequestContext,
        id: number | string,
    ): Promise<PosPurchaseOrder> {
        const repo = this.connection.getRepository(ctx, PosPurchaseOrder);
        const po = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!po) throw new UserInputError('Purchase order not found.');
        if (po.status !== 'OPEN') {
            throw new UserInputError(`Cannot cancel PO in status "${po.status}".`);
        }
        po.status = 'CANCELLED';
        return repo.save(po);
    }

    async convertPurchaseOrderToPurchase(
        ctx: RequestContext,
        id: number | string,
    ): Promise<PharmaPurchase> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosPurchaseOrder);
            const po = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!po) throw new UserInputError('Purchase order not found.');
            if (po.status !== 'OPEN') {
                throw new UserInputError(`Cannot convert PO in status "${po.status}".`);
            }

            const rows: PurchaseRowInput[] = (() => {
                try {
                    return JSON.parse(po.rowsJson || '[]') || [];
                } catch {
                    return [];
                }
            })();

            const purchase = await this.createPurchase(tCtx, {
                purNo: po.poNo,
                purDate: po.poDate,
                supplier: po.supplier || '',
                address: po.address || '',
                payType: 'Cash',
                rows,
                totalAmount: po.totalAmount,
                netAmount: po.netAmount,
            });

            po.status = 'CONVERTED';
            po.convertedPurchaseId = purchase.id as unknown as number;
            await repo.save(po);

            return purchase;
        });
    }

    // ───────────── POS EXPENSE CATEGORY ─────────────
    async listExpenseCategories(ctx: RequestContext): Promise<PosExpenseCategory[]> {
        return this.connection.getRepository(ctx, PosExpenseCategory).find({
            where: { status: 'ACTIVE' },
            order: { name: 'ASC' },
            take: MAX_LIST,
        });
    }

    async createExpenseCategory(
        ctx: RequestContext,
        input: CreatePosExpenseCategoryInput,
    ): Promise<PosExpenseCategory> {
        const repo = this.connection.getRepository(ctx, PosExpenseCategory);
        const dup = await repo.findOne({ where: { name: input.name, status: 'ACTIVE' } });
        if (dup) throw new UserInputError(`Expense category "${input.name}" already exists.`);
        const cat = new PosExpenseCategory({ name: input.name, status: 'ACTIVE' });
        return repo.save(cat);
    }

    async updateExpenseCategory(
        ctx: RequestContext,
        id: number | string,
        input: Partial<CreatePosExpenseCategoryInput>,
    ): Promise<PosExpenseCategory> {
        const repo = this.connection.getRepository(ctx, PosExpenseCategory);
        const cat = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!cat) throw new UserInputError('Expense category not found.');
        if (input.name && input.name !== cat.name) {
            const dup = await repo.findOne({
                where: { name: input.name, status: 'ACTIVE' },
            });
            if (dup && (dup.id as unknown as number) !== cat.id) {
                throw new UserInputError(`Expense category "${input.name}" already exists.`);
            }
        }
        Object.assign(cat, input);
        return repo.save(cat);
    }

    async cancelExpenseCategory(
        ctx: RequestContext,
        id: number | string,
    ): Promise<PosExpenseCategory> {
        const repo = this.connection.getRepository(ctx, PosExpenseCategory);
        const cat = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!cat) throw new UserInputError('Expense category not found.');
        cat.status = 'CANCELLED';
        return repo.save(cat);
    }

    // ───────────── POS EXPENSE ITEM ─────────────
    async listExpenseItems(ctx: RequestContext): Promise<PosExpenseItem[]> {
        return this.connection.getRepository(ctx, PosExpenseItem).find({
            where: { status: 'ACTIVE' },
            order: { itemName: 'ASC' },
            take: MAX_LIST,
        });
    }

    async createExpenseItem(
        ctx: RequestContext,
        input: CreatePosExpenseItemInput,
    ): Promise<PosExpenseItem> {
        const repo = this.connection.getRepository(ctx, PosExpenseItem);
        const item = new PosExpenseItem({
            itemName: input.itemName,
            hsnCode: input.hsnCode || '',
            description: input.description || '',
            price: input.price || 0,
            taxMode: input.taxMode || 'Without Tax',
            taxPercent: input.taxPercent || 0,
            status: 'ACTIVE',
        });
        return repo.save(item);
    }

    async updateExpenseItem(
        ctx: RequestContext,
        id: number | string,
        input: Partial<CreatePosExpenseItemInput>,
    ): Promise<PosExpenseItem> {
        const repo = this.connection.getRepository(ctx, PosExpenseItem);
        const item = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!item) throw new UserInputError('Expense item not found.');
        Object.assign(item, input);
        return repo.save(item);
    }

    async cancelExpenseItem(ctx: RequestContext, id: number | string): Promise<PosExpenseItem> {
        const repo = this.connection.getRepository(ctx, PosExpenseItem);
        const item = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!item) throw new UserInputError('Expense item not found.');
        item.status = 'CANCELLED';
        return repo.save(item);
    }

    // ───────────── POS EXPENSE ─────────────
    async listExpenses(
        ctx: RequestContext,
        fromDate?: string,
        toDate?: string,
    ): Promise<PosExpense[]> {
        const where: any = { status: 'ACTIVE' };
        const dr = this.dateRangeWhere(fromDate, toDate);
        if (dr) where.expenseDate = dr;
        return this.connection.getRepository(ctx, PosExpense).find({
            where,
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async getExpense(ctx: RequestContext, id: number | string): Promise<PosExpense | null> {
        return this.connection.getRepository(ctx, PosExpense).findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
    }

    /**
     * Validate expense rows + compute the per-line GST breakup authoritatively.
     * `gstEnabled=false` zeroes all tax (a non-GST expense voucher). Each row's
     * taxMode decides inclusive ('With Tax') vs exclusive ('Without Tax').
     * Optionally fills name/price/tax defaults from a PosExpenseItem master.
     */
    private async enrichExpenseRows(
        ctx: RequestContext,
        rows: ExpenseRowInput[] | undefined,
        billCtx: { gstEnabled: boolean; interState: boolean },
    ): Promise<ExpenseRowInput[]> {
        const list = rows || [];
        if (list.length === 0) {
            throw new UserInputError('Expense requires at least one row.');
        }
        const itemRepo = this.connection.getRepository(ctx, PosExpenseItem);
        const enriched: ExpenseRowInput[] = [];
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            let master: PosExpenseItem | null = null;
            if (row.expenseItemId != null && String(row.expenseItemId).trim() !== '') {
                master = await itemRepo.findOne({
                    where: { id: Number(row.expenseItemId), status: 'ACTIVE' } as any,
                });
                if (!master) {
                    throw new UserInputError(
                        `Expense row #${i + 1}: expense item id=${row.expenseItemId} not found.`,
                    );
                }
            }
            const itemName = String(row.itemName ?? master?.itemName ?? '').trim();
            if (!itemName) {
                throw new UserInputError(`Expense row #${i + 1}: item name is required.`);
            }
            const qty = parseFloat(String(row.qty ?? 1)) || 0;
            if (qty <= 0) {
                throw new UserInputError(`Expense row #${i + 1} ("${itemName}"): Quantity must be > 0.`);
            }
            const price = parseFloat(String(row.price ?? master?.price ?? 0)) || 0;
            if (price <= 0) {
                throw new UserInputError(`Expense row #${i + 1} ("${itemName}"): Amount must be > 0.`);
            }
            const taxMode: TaxMode = (row.taxMode ?? master?.taxMode ?? 'Without Tax') as TaxMode;
            const inclusive = taxMode === 'With Tax';
            const taxPercent = billCtx.gstEnabled
                ? parseFloat(String(row.taxPercent ?? master?.taxPercent ?? 0)) || 0
                : 0;

            const tax = computeLineTax({
                rate: price,
                qty,
                gstPercent: taxPercent,
                inclusive,
                interState: billCtx.interState,
                discountPct: parseFloat(String(row.discountPct ?? 0)) || 0,
                discountFlat: parseFloat(String(row.discountFlat ?? 0)) || 0,
            });

            enriched.push({
                ...row,
                expenseItemId: master ? Number(master.id) : (row.expenseItemId ?? null),
                itemName,
                hsnCode: String(row.hsnCode ?? master?.hsnCode ?? ''),
                qty,
                price,
                taxMode,
                taxPercent,
                // ── GST breakup (server-computed) ──
                priceInclusive: inclusive,
                interState: billCtx.interState,
                taxableAmount: tax.taxable,
                cgstAmount: tax.cgst,
                sgstAmount: tax.sgst,
                igstAmount: tax.igst,
                taxAmount: tax.gstAmount,
                lineTotal: tax.total,
            });
        }
        return enriched;
    }

    async createExpense(ctx: RequestContext, input: CreatePosExpenseInput): Promise<PosExpense> {
        if (!input.expenseNo || !String(input.expenseNo).trim()) {
            throw new UserInputError('Expense Number is required.');
        }
        if (!input.expenseDate || !String(input.expenseDate).trim()) {
            throw new UserInputError('Expense Date is required.');
        }
        // Every expense must state WHY it was spent: category (type) + description (reason).
        if (input.categoryId == null) {
            throw new UserInputError('Expense Category is required (the reason/type of this expense).');
        }
        if (!input.description || !String(input.description).trim()) {
            throw new UserInputError('Expense Description (reason) is required.');
        }
        const repo = this.connection.getRepository(ctx, PosExpense);

        // Duplicate expenseNo guard (friendly message before the DB unique error).
        const dup = await repo.findOne({ where: { expenseNo: String(input.expenseNo).trim() } });
        if (dup) throw new UserInputError(`Expense Number "${input.expenseNo}" already used.`);

        let categoryName = '';
        if (input.categoryId) {
            const cat = await this.connection.getRepository(ctx, PosExpenseCategory).findOne({
                where: { id: input.categoryId, status: 'ACTIVE' } as any,
            });
            if (!cat) throw new UserInputError(`Active expense category id=${input.categoryId} not found.`);
            categoryName = cat.name;
        }

        // gstApplied is the master switch; default ON unless explicitly disabled.
        const gstEnabled = input.gstApplied !== false;
        const interState = await this.resolveBillInterState(ctx, input.placeOfSupply, input.otherState);
        const rows = await this.enrichExpenseRows(ctx, input.rows, { gstEnabled, interState });

        // Server-authoritative totals from the per-line breakup.
        const taxSummary = summarizeTax(rows.map(r => this.rowToLineTax(r)));
        const roundOff = Number(input.roundOff ?? 0) || 0;
        const serverNet = round2(taxSummary.linesTotal + roundOff);

        const declaredNet = Number(input.netAmount ?? serverNet);
        if (declaredNet > 0 && Math.abs(serverNet - declaredNet) > 2) {
            throw new UserInputError(
                `Expense total mismatch: server computes ₹${serverNet.toFixed(2)} (taxable ₹${taxSummary.taxableTotal.toFixed(
                    2,
                )} + GST ₹${taxSummary.taxTotal.toFixed(2)} + round-off ₹${roundOff.toFixed(
                    2,
                )}) but netAmount is ₹${declaredNet.toFixed(2)}.`,
            );
        }

        const exp = new PosExpense({
            expenseNo: String(input.expenseNo).trim(),
            expenseDate: input.expenseDate,
            categoryId: input.categoryId ?? null,
            categoryName,
            // Reflect reality: GST applied only if tax actually computed.
            gstApplied: taxSummary.taxTotal > 0,
            payType: input.payType || 'Cash',
            vendorName: String(input.vendorName || '').trim(),
            vendorGstin: String(input.vendorGstin || '').trim().toUpperCase(),
            billNumber: String(input.billNumber || '').trim(),
            billDate: String(input.billDate || '').trim(),
            placeOfSupply: String(input.placeOfSupply || '').trim(),
            itcClaimable: input.itcClaimable !== false,
            rowsJson: JSON.stringify(rows),
            roundOff,
            // totalAmount = taxable base; taxAmount derived as net − roundOff − totalAmount.
            totalAmount: taxSummary.taxableTotal,
            netAmount: serverNet,
            description: input.description || '',
            remarks: input.remarks || '',
            status: 'ACTIVE',
            createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
        });
        return repo.save(exp);
    }

    async cancelExpense(ctx: RequestContext, id: number | string): Promise<PosExpense> {
        const repo = this.connection.getRepository(ctx, PosExpense);
        const exp = await repo.findOne({
            where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
        });
        if (!exp) throw new UserInputError('Expense not found.');
        exp.status = 'CANCELLED';
        return repo.save(exp);
    }

    // ───────────── DAY BOOK (cash/bank movement) ─────────────
    /**
     * Day Book = chronological cash/bank movements for a date range.
     *
     * Non-overlapping money sources (no double-counting):
     *   IN  = Sale.receivedAmount (cash taken at billing)
     *       + Receipt.recAmount   (later customer settlements)
     *   OUT = Purchase.netAmount  (only payType ≠ CREDIT — cash purchases)
     *       + Payment.totalPaying (later supplier settlements; totalDisc is NOT cash)
     *       + Expense.netAmount
     *
     * A credit sale records 0 at billing and the cash only when a Receipt is made,
     * so summing Sale.receivedAmount + Receipt.recAmount never double-counts. Same
     * logic for credit purchases vs Payments. Cancelled sales/purchases/expenses
     * are excluded; receipts/payments have no cancel state.
     */
    async getDayBook(
        ctx: RequestContext,
        fromDate: string,
        toDate?: string,
    ): Promise<DayBookReport> {
        const from = String(fromDate || '').trim();
        if (!from) throw new UserInputError('fromDate is required (YYYY-MM-DD).');
        const to = String(toDate || from).trim();
        if (to < from) throw new UserInputError('toDate cannot be earlier than fromDate.');

        const entries = await this.collectDayBookEntries(ctx, from, to);
        entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type.localeCompare(b.type)));

        let totalIn = 0;
        let totalOut = 0;
        for (const e of entries) {
            totalIn += e.inAmount;
            totalOut += e.outAmount;
        }
        totalIn = round2(totalIn);
        totalOut = round2(totalOut);
        const netFlow = round2(totalIn - totalOut);
        const openingBalance = await this.dayBookNetBefore(ctx, from);

        return {
            fromDate: from,
            toDate: to,
            openingBalance,
            totalIn,
            totalOut,
            netFlow,
            closingBalance: round2(openingBalance + netFlow),
            entries,
        };
    }

    /** Build the in-range Day Book entries from every cash source. */
    private async collectDayBookEntries(
        ctx: RequestContext,
        from: string,
        to: string,
    ): Promise<DayBookEntry[]> {
        const between = Between(from, to) as any;
        const entries: DayBookEntry[] = [];

        // IN — Sales (cash taken at billing). Skip pure-credit (received = 0).
        const sales = await this.connection.getRepository(ctx, PharmaSale).find({
            where: { billDate: between, status: 'ACTIVE' } as any,
            take: MAX_LIST,
        });
        for (const s of sales) {
            const amt = round2(Number(s.receivedAmount) || 0);
            if (amt <= 0) continue;
            entries.push({
                date: s.billDate,
                type: 'SALE',
                refNo: s.billNo,
                particulars: s.customerName || 'Walk-in',
                mode: s.saleType || 'CASH',
                inAmount: amt,
                outAmount: 0,
            });
        }

        // IN — Receipts (later customer settlements).
        const receipts = await this.connection.getRepository(ctx, PharmaReceipt).find({
            where: { docDate: between } as any,
            take: MAX_LIST,
        });
        for (const r of receipts) {
            const amt = round2(Number(r.recAmount) || 0);
            if (amt <= 0) continue;
            entries.push({
                date: r.docDate,
                type: 'RECEIPT',
                refNo: r.docNo,
                particulars: r.accHead || '',
                mode: r.payMode || 'Cash',
                inAmount: amt,
                outAmount: 0,
            });
        }

        // OUT — Purchases (cash purchases only; credit posts to ledger, not cash).
        const purchases = await this.connection.getRepository(ctx, PharmaPurchase).find({
            where: { purDate: between, status: 'ACTIVE' } as any,
            take: MAX_LIST,
        });
        for (const p of purchases) {
            if (String(p.payType || '').toUpperCase() === 'CREDIT') continue;
            const amt = round2(Number(p.netAmount) || 0);
            if (amt <= 0) continue;
            entries.push({
                date: p.purDate,
                type: 'PURCHASE',
                refNo: p.purNo,
                particulars: p.supplier || '',
                mode: p.payType || 'Cash',
                inAmount: 0,
                outAmount: amt,
            });
        }

        // OUT — Payments (later supplier settlements; cash = totalPaying).
        const payments = await this.connection.getRepository(ctx, PharmaPayment).find({
            where: { payDate: between } as any,
            take: MAX_LIST,
        });
        for (const p of payments) {
            const amt = round2(Number(p.totalPaying) || 0);
            if (amt <= 0) continue;
            entries.push({
                date: p.payDate,
                type: 'PAYMENT',
                refNo: p.payNo,
                particulars: p.supplierName || '',
                mode: p.payType || 'Cash',
                inAmount: 0,
                outAmount: amt,
            });
        }

        // OUT — Expenses.
        const expenses = await this.connection.getRepository(ctx, PosExpense).find({
            where: { expenseDate: between, status: 'ACTIVE' } as any,
            take: MAX_LIST,
        });
        for (const e of expenses) {
            const amt = round2(Number(e.netAmount) || 0);
            if (amt <= 0) continue;
            const reason = [e.categoryName, e.description].filter(Boolean).join(' — ');
            entries.push({
                date: e.expenseDate,
                type: 'EXPENSE',
                refNo: e.expenseNo,
                particulars: reason,
                mode: e.payType || 'Cash',
                inAmount: 0,
                outAmount: amt,
            });
        }

        return entries;
    }

    /** Cumulative net cash movement strictly before `from` (for opening balance). */
    private async dayBookNetBefore(ctx: RequestContext, from: string): Promise<number> {
        const sumBefore = async (
            entity: any,
            dateCol: string,
            amountCol: string,
            extra?: (qb: any) => void,
        ): Promise<number> => {
            const qb = this.connection
                .getRepository(ctx, entity)
                .createQueryBuilder('e')
                .select(`COALESCE(SUM(e.${amountCol}), 0)`, 'total')
                .where(`e.${dateCol} < :from`, { from });
            if (extra) extra(qb);
            const raw = await qb.getRawOne<{ total: string | number }>();
            return Number(raw?.total) || 0;
        };

        const salesIn = await sumBefore(PharmaSale, 'billDate', 'receivedAmount', qb =>
            qb.andWhere('e.status = :st', { st: 'ACTIVE' }),
        );
        const receiptsIn = await sumBefore(PharmaReceipt, 'docDate', 'recAmount');
        const purchaseOut = await sumBefore(PharmaPurchase, 'purDate', 'netAmount', qb =>
            qb
                .andWhere('e.status = :st', { st: 'ACTIVE' })
                .andWhere('UPPER(e.payType) != :cr', { cr: 'CREDIT' }),
        );
        const paymentOut = await sumBefore(PharmaPayment, 'payDate', 'totalPaying');
        const expenseOut = await sumBefore(PosExpense, 'expenseDate', 'netAmount', qb =>
            qb.andWhere('e.status = :st', { st: 'ACTIVE' }),
        );

        return round2(salesIn + receiptsIn - purchaseOut - paymentOut - expenseOut);
    }

    // ───────────── GST REPORT (output vs input tax) ─────────────
    /**
     * GST summary for a date range. Output tax = GST collected on sales;
     * Input tax (ITC) = GST paid on purchases + expenses. Both are aggregated
     * per slab from the per-line breakup stored in itemsJson/rowsJson (the
     * server-computed taxableAmount/cgst/sgst/igst). Transactions created before
     * the tax-calc feature have no breakup and contribute nothing (go-forward
     * data is fully covered). netGstPayable = output − input.
     */
    /**
     * Reliable date-range filter for reports. billDate/purDate/retDate/expenseDate are
     * user-supplied dd/mm/yyyy varchars, so string `Between` never matches a YYYY-MM-DD
     * input. createdAt (datetime) is reliable and indexed — same fix the sales report uses.
     */
    private createdAtBetween(fromDate?: string, toDate?: string): unknown {
        const todayIso = new Date().toISOString().slice(0, 10);
        const fromStr = fromDate || todayIso;
        const toStr = toDate || fromStr;
        const fromDt = parseFlexDate(fromStr, false) ?? parseFlexDate(todayIso, false)!;
        const toDt = parseFlexDate(toStr, true) ?? parseFlexDate(todayIso, true)!;
        return Between(fromDt, toDt);
    }

    async getGstReport(ctx: RequestContext, fromDate: string, toDate?: string): Promise<GstReport> {
        const from = String(fromDate || '').trim();
        if (!from) throw new UserInputError('fromDate is required (YYYY-MM-DD).');
        const to = String(toDate || from).trim();
        if (to < from) throw new UserInputError('toDate cannot be earlier than fromDate.');
        const between = this.createdAtBetween(from, to) as any;

        // Output — sales, minus sales returns (credit notes / CDNR).
        const sales = await this.connection
            .getRepository(ctx, PharmaSale)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const salesReturns = await this.connection
            .getRepository(ctx, PosSalesReturn)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const outputAcc = new Map<number, GstSlabRow>();
        for (const s of sales) this.accumulateGst(outputAcc, s.itemsJson, 1);
        for (const r of salesReturns) this.accumulateGst(outputAcc, r.rowsJson, -1);

        // Input (ITC) — purchases + expenses, minus purchase returns. Only
        // ITC-eligible/claimable rows count towards input credit.
        const purchases = await this.connection
            .getRepository(ctx, PharmaPurchase)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const expenses = await this.connection
            .getRepository(ctx, PosExpense)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const purchaseReturns = await this.connection
            .getRepository(ctx, PosPurchaseReturn)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const inputAcc = new Map<number, GstSlabRow>();
        for (const p of purchases) {
            if (p.itcEligible === false) continue;
            this.accumulateGst(inputAcc, p.rowsJson, 1);
        }
        for (const e of expenses) {
            if (e.itcClaimable === false) continue;
            this.accumulateGst(inputAcc, e.rowsJson, 1);
        }
        for (const r of purchaseReturns) this.accumulateGst(inputAcc, r.rowsJson, -1);

        const output = this.buildGstSection(outputAcc);
        const input = this.buildGstSection(inputAcc);
        const active = await this.getActiveCompany(ctx);
        return {
            fromDate: from,
            toDate: to,
            company: active
                ? {
                      companyName: active.companyName,
                      gstin: active.gstin,
                      stateName: active.stateName,
                      stateCode: active.stateCode,
                  }
                : null,
            output,
            input,
            netGstPayable: round2(output.taxTotal - input.taxTotal),
        };
    }

    /**
     * Fold one transaction's JSON rows into a per-slab accumulator. `sign` is +1
     * for sales/purchases/expenses and -1 for returns (which reduce the totals).
     */
    private accumulateGst(acc: Map<number, GstSlabRow>, rowsJson: string | null, sign = 1): void {
        let rows: any[] = [];
        try {
            rows = JSON.parse(rowsJson || '[]') || [];
        } catch {
            rows = [];
        }
        for (const r of rows) {
            const taxable = Number(r.taxableAmount) || 0;
            const cgst = Number(r.cgstAmount) || 0;
            const sgst = Number(r.sgstAmount) || 0;
            const igst = Number(r.igstAmount) || 0;
            const cess = Number(r.cessAmount) || 0;
            const tax = Number(r.taxAmount) || 0;
            // Skip rows with no tax breakup (old/pre-feature data or junk).
            if (taxable === 0 && tax === 0 && cess === 0) continue;
            const slab = Number(r.gstPercent) || 0;
            const a = acc.get(slab) || {
                gstPercent: slab,
                taxableAmount: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                cess: 0,
                totalTax: 0,
            };
            a.taxableAmount += taxable * sign;
            a.cgst += cgst * sign;
            a.sgst += sgst * sign;
            a.igst += igst * sign;
            a.cess += cess * sign;
            a.totalTax += tax * sign;
            acc.set(slab, a);
        }
    }

    /** Round + total a per-slab accumulator into a report section. */
    private buildGstSection(acc: Map<number, GstSlabRow>): GstReportSection {
        const slabs = [...acc.values()]
            .map(s => ({
                gstPercent: s.gstPercent,
                taxableAmount: round2(s.taxableAmount),
                cgst: round2(s.cgst),
                sgst: round2(s.sgst),
                igst: round2(s.igst),
                cess: round2(s.cess),
                totalTax: round2(s.totalTax),
            }))
            .sort((a, b) => a.gstPercent - b.gstPercent);
        const section: GstReportSection = {
            taxableTotal: 0,
            cgstTotal: 0,
            sgstTotal: 0,
            igstTotal: 0,
            cessTotal: 0,
            taxTotal: 0,
            slabs,
        };
        for (const s of slabs) {
            section.taxableTotal += s.taxableAmount;
            section.cgstTotal += s.cgst;
            section.sgstTotal += s.sgst;
            section.igstTotal += s.igst;
            section.cessTotal += s.cess;
            section.taxTotal += s.totalTax;
        }
        section.taxableTotal = round2(section.taxableTotal);
        section.cgstTotal = round2(section.cgstTotal);
        section.sgstTotal = round2(section.sgstTotal);
        section.igstTotal = round2(section.igstTotal);
        section.cessTotal = round2(section.cessTotal);
        section.taxTotal = round2(section.taxTotal);
        return section;
    }

    // ───────────── PURCHASE REPORT ─────────────
    /** Purchase totals + per-supplier rollup for a date range (ACTIVE only). */
    async getPurchaseReport(
        ctx: RequestContext,
        fromDate: string,
        toDate?: string,
    ): Promise<PurchaseReport> {
        const from = String(fromDate || '').trim();
        if (!from) throw new UserInputError('fromDate is required (YYYY-MM-DD).');
        const to = String(toDate || from).trim();
        if (to < from) throw new UserInputError('toDate cannot be earlier than fromDate.');

        const purchases = await this.connection
            .getRepository(ctx, PharmaPurchase)
            .find({ where: { createdAt: this.createdAtBetween(from, to), status: 'ACTIVE' } as any, take: MAX_LIST });

        const bySupplierMap = new Map<string, PurchaseSupplierRow>();
        let totalTaxable = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        let totalNet = 0;
        for (const p of purchases) {
            const taxable = Number(p.totalAmount) || 0;
            const tax = Number(p.totalTax) || 0;
            const discount = Number(p.totalDiscA) || 0;
            const net = Number(p.netAmount) || 0;
            totalTaxable += taxable;
            totalTax += tax;
            totalDiscount += discount;
            totalNet += net;

            const key = (p.supplier || '').trim() || '(Unknown)';
            const row = bySupplierMap.get(key) || {
                supplier: key,
                billCount: 0,
                taxable: 0,
                tax: 0,
                discount: 0,
                net: 0,
            };
            row.billCount += 1;
            row.taxable += taxable;
            row.tax += tax;
            row.discount += discount;
            row.net += net;
            bySupplierMap.set(key, row);
        }

        const bySupplier = [...bySupplierMap.values()]
            .map(r => ({
                supplier: r.supplier,
                billCount: r.billCount,
                taxable: round2(r.taxable),
                tax: round2(r.tax),
                discount: round2(r.discount),
                net: round2(r.net),
            }))
            .sort((a, b) => b.net - a.net);

        return {
            fromDate: from,
            toDate: to,
            billCount: purchases.length,
            totalTaxable: round2(totalTaxable),
            totalTax: round2(totalTax),
            totalDiscount: round2(totalDiscount),
            totalNet: round2(totalNet),
            bySupplier,
        };
    }

    // ───────────── EXPENSE REPORT ─────────────
    /** Expense totals + per-category rollup for a date range (ACTIVE only). */
    async getExpenseReport(
        ctx: RequestContext,
        fromDate: string,
        toDate?: string,
    ): Promise<ExpenseReport> {
        const from = String(fromDate || '').trim();
        if (!from) throw new UserInputError('fromDate is required (YYYY-MM-DD).');
        const to = String(toDate || from).trim();
        if (to < from) throw new UserInputError('toDate cannot be earlier than fromDate.');

        const expenses = await this.connection
            .getRepository(ctx, PosExpense)
            .find({ where: { createdAt: this.createdAtBetween(from, to), status: 'ACTIVE' } as any, take: MAX_LIST });

        const byCatMap = new Map<string, ExpenseCategoryRow>();
        let totalTaxable = 0;
        let totalTax = 0;
        let totalNet = 0;
        for (const e of expenses) {
            const taxable = Number(e.totalAmount) || 0;
            const net = Number(e.netAmount) || 0;
            // taxAmount = net − roundOff − totalAmount (same derivation as the field resolver).
            const tax = round2(net - (Number(e.roundOff) || 0) - taxable);
            totalTaxable += taxable;
            totalTax += tax;
            totalNet += net;

            const key = e.categoryId != null ? String(e.categoryId) : '(none)';
            const row = byCatMap.get(key) || {
                categoryId: e.categoryId ?? null,
                categoryName: e.categoryName || '(Uncategorised)',
                count: 0,
                taxable: 0,
                tax: 0,
                net: 0,
            };
            row.count += 1;
            row.taxable += taxable;
            row.tax += tax;
            row.net += net;
            byCatMap.set(key, row);
        }

        const byCategory = [...byCatMap.values()]
            .map(r => ({
                categoryId: r.categoryId,
                categoryName: r.categoryName,
                count: r.count,
                taxable: round2(r.taxable),
                tax: round2(r.tax),
                net: round2(r.net),
            }))
            .sort((a, b) => b.net - a.net);

        return {
            fromDate: from,
            toDate: to,
            expenseCount: expenses.length,
            totalTaxable: round2(totalTaxable),
            totalTax: round2(totalTax),
            totalNet: round2(totalNet),
            byCategory,
        };
    }

    // ───────────── GSTR-1 / GSTR-3B (filing returns) ─────────────

    /** Active company → GstReturnCompany shape (null if none configured). */
    private async returnCompany(ctx: RequestContext): Promise<GstReturnCompany | null> {
        const c = await this.getActiveCompany(ctx);
        return c
            ? {
                  companyName: c.companyName,
                  gstin: c.gstin,
                  stateName: c.stateName,
                  stateCode: c.stateCode,
              }
            : null;
    }

    /** Parse a snapshot itemsJson/rowsJson into normalised GST lines. */
    private parseGstLines(json: string | null): GstLine[] {
        let rows: any[] = [];
        try {
            rows = JSON.parse(json || '[]') || [];
        } catch {
            rows = [];
        }
        return rows.map(r => ({
            itemName: String(r.itemName || r.itemCode || ''),
            hsnCode: String(r.hsnCode || ''),
            unit: String(r.unit || ''),
            qty: Number(r.qty) || 0,
            gstPercent: Number(r.gstPercent) || 0,
            interState: !!r.interState,
            taxableAmount: Number(r.taxableAmount) || 0,
            cgstAmount: Number(r.cgstAmount) || 0,
            sgstAmount: Number(r.sgstAmount) || 0,
            igstAmount: Number(r.igstAmount) || 0,
            cessAmount: Number(r.cessAmount) || 0,
            taxAmount: Number(r.taxAmount) || 0,
        }));
    }

    private saleToGstDoc(s: PharmaSale): GstDoc {
        return {
            docNo: s.billNo,
            docDate: s.billDate,
            customerGstin: s.customerGstin || '',
            customerName: s.customerName || '',
            placeOfSupply: s.placeOfSupply || '',
            reverseCharge: !!s.reverseCharge,
            docValue: Number(s.grandTotal) || 0,
            lines: this.parseGstLines(s.itemsJson),
        };
    }

    private salesReturnToGstDoc(r: PosSalesReturn): GstDoc {
        return {
            docNo: r.retNo,
            docDate: r.retDate,
            customerGstin: r.customerGstin || '',
            customerName: r.customerName || '',
            placeOfSupply: r.placeOfSupply || '',
            reverseCharge: false,
            docValue: Number(r.netAmount) || 0,
            lines: this.parseGstLines(r.rowsJson),
        };
    }

    /** Sum a purchase/expense/return JSON into a single inward (ITC/RCM) doc. */
    private inwardFromJson(json: string | null, interState: boolean, reverseCharge: boolean): GstInwardDoc {
        const lines = this.parseGstLines(json);
        const acc: GstInwardDoc = { interState, reverseCharge, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
        for (const l of lines) {
            acc.taxable += l.taxableAmount;
            acc.cgst += l.cgstAmount;
            acc.sgst += l.sgstAmount;
            acc.igst += l.igstAmount;
            acc.cess += l.cessAmount;
        }
        acc.taxable = round2(acc.taxable);
        acc.cgst = round2(acc.cgst);
        acc.sgst = round2(acc.sgst);
        acc.igst = round2(acc.igst);
        acc.cess = round2(acc.cess);
        return acc;
    }

    private normRange(fromDate: string, toDate?: string): { from: string; to: string } {
        const from = String(fromDate || '').trim();
        if (!from) throw new UserInputError('fromDate is required (YYYY-MM-DD).');
        const to = String(toDate || from).trim();
        if (to < from) throw new UserInputError('toDate cannot be earlier than fromDate.');
        return { from, to };
    }

    /** DOCS section: invoice serial range + cancelled count over ALL statuses. */
    private async buildDocSummary(
        ctx: RequestContext,
        from: string,
        to: string,
    ): Promise<{ fromSerial: string; toSerial: string; totalCount: number; cancelledCount: number }> {
        const all = await this.connection
            .getRepository(ctx, PharmaSale)
            .find({ where: { createdAt: this.createdAtBetween(from, to) } as any, take: MAX_LIST });
        const serials = all.map(s => String(s.billNo || '')).filter(Boolean).sort();
        const cancelledCount = all.filter(s => s.status === 'CANCELLED').length;
        return {
            fromSerial: serials[0] || '',
            toSerial: serials[serials.length - 1] || '',
            totalCount: all.length,
            cancelledCount,
        };
    }

    /** Structured GSTR-1 (B2B/B2CL/B2CS/CDNR/HSN/DOCS) for a date range. */
    async getGstr1Report(ctx: RequestContext, fromDate: string, toDate?: string): Promise<Gstr1Report> {
        const { from, to } = this.normRange(fromDate, toDate);
        const between = this.createdAtBetween(from, to) as any;
        const sales = await this.connection
            .getRepository(ctx, PharmaSale)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const salesReturns = await this.connection
            .getRepository(ctx, PosSalesReturn)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const docSummary = await this.buildDocSummary(ctx, from, to);
        return buildGstr1({
            fromDate: from,
            toDate: to,
            company: await this.returnCompany(ctx),
            sales: sales.map(s => this.saleToGstDoc(s)),
            salesReturns: salesReturns.map(r => this.salesReturnToGstDoc(r)),
            docSummary,
        });
    }

    /** Structured GSTR-3B (3.1 outward · 4 ITC · net payable) for a date range. */
    async getGstr3bReport(ctx: RequestContext, fromDate: string, toDate?: string): Promise<Gstr3bReport> {
        const { from, to } = this.normRange(fromDate, toDate);
        const between = this.createdAtBetween(from, to) as any;
        const sales = await this.connection
            .getRepository(ctx, PharmaSale)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const salesReturns = await this.connection
            .getRepository(ctx, PosSalesReturn)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const purchases = await this.connection
            .getRepository(ctx, PharmaPurchase)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const expenses = await this.connection
            .getRepository(ctx, PosExpense)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });
        const purchaseReturns = await this.connection
            .getRepository(ctx, PosPurchaseReturn)
            .find({ where: { createdAt: between, status: 'ACTIVE' } as any, take: MAX_LIST });

        const inwardItc: GstInwardDoc[] = [];
        const inwardRcm: GstInwardDoc[] = [];
        for (const p of purchases) {
            if (p.reverseCharge) {
                inwardRcm.push(this.inwardFromJson(p.rowsJson, !!p.otherState, true));
            } else if (p.itcEligible !== false) {
                inwardItc.push(this.inwardFromJson(p.rowsJson, !!p.otherState, false));
            }
        }
        for (const e of expenses) {
            if (e.itcClaimable !== false) inwardItc.push(this.inwardFromJson(e.rowsJson, false, false));
        }
        const inwardReturns = purchaseReturns.map(r => this.inwardFromJson(r.rowsJson, false, false));

        return buildGstr3b({
            fromDate: from,
            toDate: to,
            company: await this.returnCompany(ctx),
            sales: sales.map(s => this.saleToGstDoc(s)),
            salesReturns: salesReturns.map(r => this.salesReturnToGstDoc(r)),
            inwardItc,
            inwardRcm,
            inwardReturns,
        });
    }

    /** GSTR-1 as the official GSTN portal JSON (uploadable), serialised to string. */
    async getGstr1PortalJson(ctx: RequestContext, fromDate: string, toDate?: string): Promise<string> {
        const report = await this.getGstr1Report(ctx, fromDate, toDate);
        return JSON.stringify(buildGstr1PortalJson(report), null, 2);
    }

    /** GSTR-1 review CSVs (one file per section). */
    async getGstr1Csvs(ctx: RequestContext, fromDate: string, toDate?: string): Promise<GstCsvFile[]> {
        const report = await this.getGstr1Report(ctx, fromDate, toDate);
        return buildGstr1Csvs(report);
    }

    /** GSTR-3B review CSV (single file). */
    async getGstr3bCsv(ctx: RequestContext, fromDate: string, toDate?: string): Promise<GstCsvFile> {
        const report = await this.getGstr3bReport(ctx, fromDate, toDate);
        return buildGstr3bCsv(report);
    }

    // ───────────── POS COMPANY (seller GST identity) ─────────────
    /** Light GSTIN format check (15 chars, standard pattern). Empty is allowed. */
    private validateGstin(gstin?: string): string {
        const g = String(gstin || '').trim().toUpperCase();
        if (!g) return '';
        // 2-digit state + 10-char PAN + entity digit + 'Z' + 1 checksum char.
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g)) {
            throw new UserInputError(`Invalid GSTIN "${g}". Expected 15-character GSTIN format.`);
        }
        return g;
    }

    async listCompanies(ctx: RequestContext): Promise<PosCompany[]> {
        return this.connection.getRepository(ctx, PosCompany).find({
            where: { status: 'ACTIVE' } as any,
            order: { isActive: 'DESC', createdAt: 'DESC' },
            take: MAX_LIST,
        });
    }

    async getActiveCompany(ctx: RequestContext): Promise<PosCompany | null> {
        return this.connection
            .getRepository(ctx, PosCompany)
            .findOne({ where: { isActive: true, status: 'ACTIVE' } as any });
    }

    async createCompany(ctx: RequestContext, input: CreatePosCompanyInput): Promise<PosCompany> {
        if (!input.companyName || !String(input.companyName).trim()) {
            throw new UserInputError('Company Name is required.');
        }
        const gstin = this.validateGstin(input.gstin);
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosCompany);
            // First company (or explicit request) becomes active; only one active at a time.
            const existingCount = await repo.count({ where: { status: 'ACTIVE' } as any });
            const makeActive = input.isActive === true || existingCount === 0;
            if (makeActive) {
                await repo.update({ isActive: true } as any, { isActive: false } as any);
            }
            const c = new PosCompany({
                companyName: String(input.companyName).trim(),
                legalName: input.legalName || '',
                gstin,
                phone: input.phone || '',
                email: input.email || '',
                address: input.address || '',
                pincode: input.pincode || '',
                stateName: input.stateName || '',
                stateCode: String(input.stateCode || '').trim(),
                financialYear: input.financialYear || '',
                isActive: makeActive,
                status: 'ACTIVE',
                createdByAdminId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
            return repo.save(c);
        });
    }

    async updateCompany(
        ctx: RequestContext,
        id: number | string,
        input: Partial<CreatePosCompanyInput>,
    ): Promise<PosCompany> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosCompany);
            const c = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!c) throw new UserInputError('Company not found.');
            if (c.status === 'CANCELLED') throw new UserInputError('Cannot edit a deleted company.');

            if (input.companyName != null) {
                if (!String(input.companyName).trim()) {
                    throw new UserInputError('Company Name cannot be blank.');
                }
                c.companyName = String(input.companyName).trim();
            }
            if (input.gstin != null) c.gstin = this.validateGstin(input.gstin);
            if (input.legalName != null) c.legalName = String(input.legalName);
            if (input.phone != null) c.phone = String(input.phone);
            if (input.email != null) c.email = String(input.email);
            if (input.address != null) c.address = String(input.address);
            if (input.pincode != null) c.pincode = String(input.pincode);
            if (input.stateName != null) c.stateName = String(input.stateName);
            if (input.stateCode != null) c.stateCode = String(input.stateCode).trim();
            if (input.financialYear != null) c.financialYear = String(input.financialYear);
            c.updatedByAdminId = ctx.activeUserId != null ? Number(ctx.activeUserId) : null;

            if (input.isActive === true && !c.isActive) {
                await repo.update({ isActive: true } as any, { isActive: false } as any);
                c.isActive = true;
            }
            return repo.save(c);
        });
    }

    async setActiveCompany(ctx: RequestContext, id: number | string): Promise<PosCompany> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosCompany);
            const c = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!c) throw new UserInputError('Company not found.');
            if (c.status === 'CANCELLED') throw new UserInputError('Cannot activate a deleted company.');
            await repo.update({ isActive: true } as any, { isActive: false } as any);
            c.isActive = true;
            return repo.save(c);
        });
    }

    async deleteCompany(ctx: RequestContext, id: number | string): Promise<PosCompany> {
        return this.connection.withTransaction(ctx, async tCtx => {
            const repo = this.connection.getRepository(tCtx, PosCompany);
            const c = await repo.findOne({
                where: { id: typeof id === 'string' ? parseInt(id, 10) : id } as any,
            });
            if (!c) throw new UserInputError('Company not found.');
            if (c.status === 'CANCELLED') throw new UserInputError('Company already deleted.');
            c.status = 'CANCELLED';
            c.isActive = false;
            return repo.save(c);
        });
    }
}
