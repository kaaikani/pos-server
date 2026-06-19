/**
 * GSTR-1 / GSTR-3B builders — pure, DB-free transformations over already
 * snapshotted sale / return / purchase rows. The persisted per-line GST breakup
 * (taxableAmount, cgst/sgst/igst/cess, gstPercent, interState, hsnCode, unit, qty)
 * is the single source of truth; nothing here recomputes tax. This module only
 * *classifies* and *aggregates* into the shapes the GST portal / accountant needs:
 *
 *   GSTR-1 sections : B2B · B2CL · B2CS · CDNR · HSN summary · DOCS
 *   GSTR-3B         : 3.1 outward · 4 ITC · net payable
 *
 * Two output flavours are produced from the same structured report:
 *   - a flat, human-readable report (rendered by the dashboard)
 *   - the official GSTN portal JSON envelope (uploadable to the offline tool)
 *   - review CSVs (one per section) mirroring the structured report
 *
 * Kept side-effect-free so it can be unit-tested in isolation.
 */
import { round2 } from './tax-calc';

/** B2C inter-state "large" threshold (₹). Current rule (eff. 2024): ₹1,00,000. */
export const B2CL_THRESHOLD = 100000;

// ───────────────────────── Input shapes (DB-mapped) ─────────────────────────

/** One snapshotted line of a sale / return, as stored in itemsJson / rowsJson. */
export interface GstLine {
    itemName: string;
    hsnCode: string;
    unit: string;
    qty: number;
    gstPercent: number;
    interState: boolean;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    taxAmount: number;
}

/** A sale or sales-return reduced to what the GSTR builders consume. */
export interface GstDoc {
    /** Invoice / note number. */
    docNo: string;
    /** YYYY-MM-DD. */
    docDate: string;
    customerGstin: string;
    customerName: string;
    /** 2-digit place-of-supply state code (may be blank → caller's fallback). */
    placeOfSupply: string;
    reverseCharge: boolean;
    /** Invoice value incl. tax (grandTotal / netAmount). */
    docValue: number;
    lines: GstLine[];
}

/** A purchase / expense reduced for GSTR-3B ITC + RCM. */
export interface GstInwardDoc {
    interState: boolean;
    reverseCharge: boolean;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
}

// ───────────────────────── Output shapes (report) ─────────────────────────

export interface GstReturnCompany {
    companyName: string;
    gstin: string;
    stateName: string;
    stateCode: string;
}

/** Rate-wise tax bucket reused across sections. */
export interface RateBucket {
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}

export interface Gstr1Invoice {
    docNo: string;
    docDate: string;
    customerGstin: string;
    customerName: string;
    placeOfSupply: string;
    reverseCharge: boolean;
    invoiceValue: number;
    interState: boolean;
    items: RateBucket[];
}

export interface Gstr1B2csRow {
    placeOfSupply: string;
    supplyType: 'INTER' | 'INTRA';
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}

export interface Gstr1HsnRow {
    hsnCode: string;
    description: string;
    uqc: string;
    totalQty: number;
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    totalValue: number;
}

export interface Gstr1DocRange {
    natureOfDocument: string;
    fromSerial: string;
    toSerial: string;
    totalCount: number;
    cancelledCount: number;
    netIssued: number;
}

export interface GstTotals {
    invoiceCount: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    totalTax: number;
}

export interface Gstr1Report {
    fromDate: string;
    toDate: string;
    filingPeriod: string;
    company: GstReturnCompany | null;
    b2b: Gstr1Invoice[];
    b2cl: Gstr1Invoice[];
    b2cs: Gstr1B2csRow[];
    cdnr: Gstr1Invoice[];
    hsn: Gstr1HsnRow[];
    docs: Gstr1DocRange[];
    totals: GstTotals;
    /** Data-quality / compliance warnings (blank HSN, blank POS, no GSTIN…). */
    warnings: string[];
}

export interface Gstr3bSupplyRow {
    label: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}

export interface Gstr3bReport {
    fromDate: string;
    toDate: string;
    filingPeriod: string;
    company: GstReturnCompany | null;
    /** 3.1 Outward / RCM supplies. */
    outward: Gstr3bSupplyRow[];
    /** 4 Eligible ITC. */
    itc: Gstr3bSupplyRow[];
    /** Net tax payable per head after ITC (output − input). */
    netTaxPayable: Gstr3bSupplyRow;
    warnings: string[];
}

// ───────────────────────── Small helpers ─────────────────────────

/** GST UQC (Unit Quantity Code) for a free-form unit string. Falls back to OTH. */
const UQC_MAP: Record<string, string> = {
    no: 'NOS', nos: 'NOS', number: 'NOS',
    pc: 'PCS', pcs: 'PCS', piece: 'PCS', pieces: 'PCS',
    box: 'BOX', boxes: 'BOX',
    kg: 'KGS', kgs: 'KGS', kilogram: 'KGS',
    g: 'GMS', gm: 'GMS', gms: 'GMS', gram: 'GMS', grams: 'GMS',
    l: 'LTR', ltr: 'LTR', litre: 'LTR', liter: 'LTR', litres: 'LTR',
    ml: 'MLT',
    m: 'MTR', mtr: 'MTR', metre: 'MTR', meter: 'MTR',
    pkt: 'PAC', pack: 'PAC', packet: 'PAC', pac: 'PAC',
    bottle: 'BTL', btl: 'BTL', bottles: 'BTL',
    dozen: 'DOZ', doz: 'DOZ',
    set: 'SET', sets: 'SET',
    pair: 'PRS', prs: 'PRS', pairs: 'PRS',
    ton: 'TON', tonne: 'TON',
    bag: 'BAG', bags: 'BAG',
    bundle: 'BUN', bun: 'BUN',
    can: 'CAN', cans: 'CAN',
    roll: 'ROL', rolls: 'ROL',
};

export function unitToUqc(unit: string): string {
    const key = String(unit || '').trim().toLowerCase();
    return UQC_MAP[key] || 'OTH';
}

/** 15-char GSTIN format check (same shape as PosCompany.validateGstin). */
export function isValidGstin(gstin: string): boolean {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        String(gstin || '').trim().toUpperCase(),
    );
}

/** YYYY-MM-DD → DD-MM-YYYY (GST portal date format). Empty/invalid → ''. */
export function toPortalDate(ymd: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Filing period MMYYYY derived from a YYYY-MM-DD date (uses the period end). */
export function filingPeriod(ymd: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    return m ? `${m[2]}${m[1]}` : '';
}

/**
 * Place of supply for a doc: its own placeOfSupply, else the seller state
 * (intra-state default). Returns '' only when neither is known.
 */
function resolvePos(doc: GstDoc, companyStateCode: string): string {
    return String(doc.placeOfSupply || '').trim() || String(companyStateCode || '').trim();
}

/** A doc is inter-state if ANY of its lines was snapshotted inter-state. */
function docInterState(doc: GstDoc): boolean {
    return doc.lines.some(l => !!l.interState);
}

/** Fold a doc's lines into rate-wise buckets (one bucket per gstPercent). */
function rateBuckets(lines: GstLine[], sign = 1): RateBucket[] {
    const map = new Map<number, RateBucket>();
    for (const l of lines) {
        const rate = Number(l.gstPercent) || 0;
        const b = map.get(rate) || { rate, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
        b.taxableValue += (Number(l.taxableAmount) || 0) * sign;
        b.igst += (Number(l.igstAmount) || 0) * sign;
        b.cgst += (Number(l.cgstAmount) || 0) * sign;
        b.sgst += (Number(l.sgstAmount) || 0) * sign;
        b.cess += (Number(l.cessAmount) || 0) * sign;
        map.set(rate, b);
    }
    return [...map.values()]
        .map(b => ({
            rate: b.rate,
            taxableValue: round2(b.taxableValue),
            igst: round2(b.igst),
            cgst: round2(b.cgst),
            sgst: round2(b.sgst),
            cess: round2(b.cess),
        }))
        .sort((a, b) => a.rate - b.rate);
}

function toInvoice(doc: GstDoc, companyStateCode: string, sign = 1): Gstr1Invoice {
    return {
        docNo: doc.docNo,
        docDate: doc.docDate,
        customerGstin: String(doc.customerGstin || '').trim().toUpperCase(),
        customerName: doc.customerName,
        placeOfSupply: resolvePos(doc, companyStateCode),
        reverseCharge: !!doc.reverseCharge,
        invoiceValue: round2((Number(doc.docValue) || 0) * sign),
        interState: docInterState(doc),
        items: rateBuckets(doc.lines, sign),
    };
}

function sumTotals(invoices: Gstr1Invoice[], rows: Gstr1B2csRow[], cdnr: Gstr1Invoice[]): GstTotals {
    const t: GstTotals = {
        invoiceCount: invoices.length + cdnr.length,
        taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, totalTax: 0,
    };
    const addBuckets = (bs: { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }[]) => {
        for (const b of bs) {
            t.taxableValue += b.taxableValue;
            t.igst += b.igst;
            t.cgst += b.cgst;
            t.sgst += b.sgst;
            t.cess += b.cess;
        }
    };
    for (const inv of invoices) addBuckets(inv.items);
    for (const inv of cdnr) addBuckets(inv.items);
    addBuckets(rows);
    t.taxableValue = round2(t.taxableValue);
    t.igst = round2(t.igst);
    t.cgst = round2(t.cgst);
    t.sgst = round2(t.sgst);
    t.cess = round2(t.cess);
    t.totalTax = round2(t.igst + t.cgst + t.sgst + t.cess);
    return t;
}

// ───────────────────────── GSTR-1 builder ─────────────────────────

export interface Gstr1BuildInput {
    fromDate: string;
    toDate: string;
    company: GstReturnCompany | null;
    /** ACTIVE sales in range. */
    sales: GstDoc[];
    /** ACTIVE sales returns (credit notes) in range. */
    salesReturns: GstDoc[];
    /** Serial info for the DOCS section. */
    docSummary?: { fromSerial: string; toSerial: string; totalCount: number; cancelledCount: number };
}

export function buildGstr1(input: Gstr1BuildInput): Gstr1Report {
    const companyState = input.company?.stateCode || '';
    const warnings: string[] = [];

    if (!input.company) warnings.push('No active company configured — seller GSTIN/state missing from the return.');
    else if (!isValidGstin(input.company.gstin)) warnings.push('Active company GSTIN is missing or invalid — required before filing.');
    if (!companyState) warnings.push('Active company state code is not set — place-of-supply fallback and intra/inter-state split are unreliable.');

    const b2b: Gstr1Invoice[] = [];
    const b2cl: Gstr1Invoice[] = [];
    const b2csMap = new Map<string, Gstr1B2csRow>();
    let blankPosCount = 0;

    for (const sale of input.sales) {
        const gstin = String(sale.customerGstin || '').trim();
        const inter = docInterState(sale);
        const pos = resolvePos(sale, companyState);
        if (!pos) blankPosCount++;

        if (gstin && isValidGstin(gstin)) {
            b2b.push(toInvoice(sale, companyState));
        } else {
            if (gstin) warnings.push(`Invoice ${sale.docNo}: customer GSTIN "${gstin}" is invalid — treated as B2C.`);
            if (inter && (Number(sale.docValue) || 0) > B2CL_THRESHOLD) {
                b2cl.push(toInvoice(sale, companyState));
            } else {
                for (const bucket of rateBuckets(sale.lines)) {
                    const supplyType: 'INTER' | 'INTRA' = inter ? 'INTER' : 'INTRA';
                    const key = `${pos}|${supplyType}|${bucket.rate}`;
                    const row = b2csMap.get(key) || {
                        placeOfSupply: pos, supplyType, rate: bucket.rate,
                        taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0,
                    };
                    row.taxableValue += bucket.taxableValue;
                    row.igst += bucket.igst;
                    row.cgst += bucket.cgst;
                    row.sgst += bucket.sgst;
                    row.cess += bucket.cess;
                    b2csMap.set(key, row);
                }
            }
        }
    }

    const b2cs = [...b2csMap.values()]
        .map(r => ({
            ...r,
            taxableValue: round2(r.taxableValue),
            igst: round2(r.igst),
            cgst: round2(r.cgst),
            sgst: round2(r.sgst),
            cess: round2(r.cess),
        }))
        .sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.rate - b.rate);

    // CDNR — credit notes to registered recipients only (others → B2C credit, out of scope here).
    const cdnr: Gstr1Invoice[] = [];
    for (const ret of input.salesReturns) {
        const gstin = String(ret.customerGstin || '').trim();
        if (gstin && isValidGstin(gstin)) cdnr.push(toInvoice(ret, companyState));
    }

    const hsn = buildHsnSummary(input.sales, input.salesReturns, warnings);
    const docs = input.docSummary
        ? [
              {
                  natureOfDocument: 'Invoices for outward supply',
                  fromSerial: input.docSummary.fromSerial,
                  toSerial: input.docSummary.toSerial,
                  totalCount: input.docSummary.totalCount,
                  cancelledCount: input.docSummary.cancelledCount,
                  netIssued: input.docSummary.totalCount - input.docSummary.cancelledCount,
              },
          ]
        : [];

    if (blankPosCount > 0)
        warnings.push(`${blankPosCount} sale(s) had no place of supply and no company state to fall back on.`);

    return {
        fromDate: input.fromDate,
        toDate: input.toDate,
        filingPeriod: filingPeriod(input.toDate),
        company: input.company,
        b2b,
        b2cl,
        b2cs,
        cdnr,
        hsn,
        docs,
        totals: sumTotals([...b2b, ...b2cl], b2cs, cdnr),
        warnings,
    };
}

/** HSN-wise summary across sales (and net of returns). */
function buildHsnSummary(sales: GstDoc[], salesReturns: GstDoc[], warnings: string[]): Gstr1HsnRow[] {
    const map = new Map<string, Gstr1HsnRow>();
    let blankHsn = 0;
    const fold = (docs: GstDoc[], sign: number) => {
        for (const d of docs) {
            for (const l of d.lines) {
                const hsn = String(l.hsnCode || '').trim();
                if (!hsn) blankHsn++;
                const rate = Number(l.gstPercent) || 0;
                const uqc = unitToUqc(l.unit);
                const key = `${hsn}|${rate}|${uqc}`;
                const r = map.get(key) || {
                    hsnCode: hsn, description: l.itemName || '', uqc, totalQty: 0, rate,
                    taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, totalValue: 0,
                };
                const taxable = (Number(l.taxableAmount) || 0) * sign;
                const igst = (Number(l.igstAmount) || 0) * sign;
                const cgst = (Number(l.cgstAmount) || 0) * sign;
                const sgst = (Number(l.sgstAmount) || 0) * sign;
                const cess = (Number(l.cessAmount) || 0) * sign;
                r.totalQty += (Number(l.qty) || 0) * sign;
                r.taxableValue += taxable;
                r.igst += igst;
                r.cgst += cgst;
                r.sgst += sgst;
                r.cess += cess;
                r.totalValue += taxable + igst + cgst + sgst + cess;
                map.set(key, r);
            }
        }
    };
    fold(sales, 1);
    fold(salesReturns, -1);
    if (blankHsn > 0)
        warnings.push(`${blankHsn} line(s) have no HSN code — grouped under blank HSN; set HSN on the item master before filing.`);
    return [...map.values()]
        .map(r => ({
            ...r,
            totalQty: round2(r.totalQty),
            taxableValue: round2(r.taxableValue),
            igst: round2(r.igst),
            cgst: round2(r.cgst),
            sgst: round2(r.sgst),
            cess: round2(r.cess),
            totalValue: round2(r.totalValue),
        }))
        .sort((a, b) => a.hsnCode.localeCompare(b.hsnCode) || a.rate - b.rate);
}

// ───────────────────────── GSTR-3B builder ─────────────────────────

export interface Gstr3bBuildInput {
    fromDate: string;
    toDate: string;
    company: GstReturnCompany | null;
    /** ACTIVE taxable outward supplies (sales). */
    sales: GstDoc[];
    /** ACTIVE sales returns (reduce outward). */
    salesReturns: GstDoc[];
    /** ITC-eligible purchases + claimable expenses. */
    inwardItc: GstInwardDoc[];
    /** Reverse-charge inward supplies (purchases with reverseCharge=true). */
    inwardRcm: GstInwardDoc[];
    /** Purchase returns (reduce ITC). */
    inwardReturns: GstInwardDoc[];
}

function blankSupplyRow(label: string): Gstr3bSupplyRow {
    return { label, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
}

function addDocToRow(row: Gstr3bSupplyRow, lines: GstLine[], sign = 1): void {
    for (const l of lines) {
        row.taxableValue += (Number(l.taxableAmount) || 0) * sign;
        row.igst += (Number(l.igstAmount) || 0) * sign;
        row.cgst += (Number(l.cgstAmount) || 0) * sign;
        row.sgst += (Number(l.sgstAmount) || 0) * sign;
        row.cess += (Number(l.cessAmount) || 0) * sign;
    }
}

function addInwardToRow(row: Gstr3bSupplyRow, docs: GstInwardDoc[], sign = 1): void {
    for (const d of docs) {
        row.taxableValue += (Number(d.taxable) || 0) * sign;
        row.igst += (Number(d.igst) || 0) * sign;
        row.cgst += (Number(d.cgst) || 0) * sign;
        row.sgst += (Number(d.sgst) || 0) * sign;
        row.cess += (Number(d.cess) || 0) * sign;
    }
}

function roundRow(row: Gstr3bSupplyRow): Gstr3bSupplyRow {
    return {
        label: row.label,
        taxableValue: round2(row.taxableValue),
        igst: round2(row.igst),
        cgst: round2(row.cgst),
        sgst: round2(row.sgst),
        cess: round2(row.cess),
    };
}

export function buildGstr3b(input: Gstr3bBuildInput): Gstr3bReport {
    const warnings: string[] = [];
    if (!input.company || !isValidGstin(input.company.gstin))
        warnings.push('Active company GSTIN is missing or invalid — required before filing GSTR-3B.');

    // 3.1(a) Outward taxable (other than zero-rated/nil/exempt). 0% lines are
    // reported separately as nil/exempt; we cannot distinguish nil vs exempt vs
    // non-GST from snapshots, so they are grouped under one nil/exempt label.
    const outwardTaxable = blankSupplyRow('3.1(a) Outward taxable supplies (other than nil/exempt)');
    const outwardNil = blankSupplyRow('3.1(c) Nil-rated / exempt / non-GST outward supplies');
    for (const s of input.sales) {
        const taxed = s.lines.filter(l => (Number(l.gstPercent) || 0) > 0);
        const nil = s.lines.filter(l => (Number(l.gstPercent) || 0) === 0);
        addDocToRow(outwardTaxable, taxed, 1);
        addDocToRow(outwardNil, nil, 1);
    }
    for (const r of input.salesReturns) {
        const taxed = r.lines.filter(l => (Number(l.gstPercent) || 0) > 0);
        const nil = r.lines.filter(l => (Number(l.gstPercent) || 0) === 0);
        addDocToRow(outwardTaxable, taxed, -1);
        addDocToRow(outwardNil, nil, -1);
    }

    // 3.1(d) Inward supplies liable to reverse charge.
    const rcm = blankSupplyRow('3.1(d) Inward supplies liable to reverse charge');
    addInwardToRow(rcm, input.inwardRcm, 1);

    const outward = [roundRow(outwardTaxable), roundRow(outwardNil), roundRow(rcm)];

    // 4 ITC available — purchases + expenses (+ RCM credit), less purchase returns.
    const itcAll = blankSupplyRow('4(A) ITC available (purchases, expenses, RCM)');
    addInwardToRow(itcAll, input.inwardItc, 1);
    addInwardToRow(itcAll, input.inwardRcm, 1);
    addInwardToRow(itcAll, input.inwardReturns, -1);
    const itc = [roundRow(itcAll)];

    // Net tax payable per head = output tax − ITC. (RCM cash liability nuance is
    // left to the accountant; this is the indicative net used by the dashboard.)
    const net: Gstr3bSupplyRow = {
        label: 'Net tax payable (output − ITC)',
        igst: round2(outwardTaxable.igst + rcm.igst - itcAll.igst),
        cgst: round2(outwardTaxable.cgst + rcm.cgst - itcAll.cgst),
        sgst: round2(outwardTaxable.sgst + rcm.sgst - itcAll.sgst),
        cess: round2(outwardTaxable.cess + rcm.cess - itcAll.cess),
        taxableValue: 0,
    };

    return {
        fromDate: input.fromDate,
        toDate: input.toDate,
        filingPeriod: filingPeriod(input.toDate),
        company: input.company,
        outward,
        itc,
        netTaxPayable: net,
        warnings,
    };
}

// ───────────────────────── Portal JSON (GSTN schema) ─────────────────────────

/** Build the official GSTN GSTR-1 JSON envelope from a structured report. */
export function buildGstr1PortalJson(report: Gstr1Report): Record<string, unknown> {
    const gstin = report.company?.gstin || '';

    // B2B — grouped by recipient GSTIN (ctin).
    const b2bByCtin = new Map<string, Gstr1Invoice[]>();
    for (const inv of report.b2b) {
        const list = b2bByCtin.get(inv.customerGstin) || [];
        list.push(inv);
        b2bByCtin.set(inv.customerGstin, list);
    }
    const b2b = [...b2bByCtin.entries()].map(([ctin, invs]) => ({
        ctin,
        inv: invs.map(inv => ({
            inum: inv.docNo,
            idt: toPortalDate(inv.docDate),
            val: inv.invoiceValue,
            pos: inv.placeOfSupply,
            rchrg: inv.reverseCharge ? 'Y' : 'N',
            inv_typ: 'R',
            itms: inv.items.map((it, i) => ({
                num: i + 1,
                itm_det: {
                    rt: it.rate,
                    txval: it.taxableValue,
                    iamt: it.igst,
                    camt: it.cgst,
                    samt: it.sgst,
                    csamt: it.cess,
                },
            })),
        })),
    }));

    // B2CL — grouped by place of supply.
    const b2clByPos = new Map<string, Gstr1Invoice[]>();
    for (const inv of report.b2cl) {
        const list = b2clByPos.get(inv.placeOfSupply) || [];
        list.push(inv);
        b2clByPos.set(inv.placeOfSupply, list);
    }
    const b2cl = [...b2clByPos.entries()].map(([pos, invs]) => ({
        pos,
        inv: invs.map(inv => ({
            inum: inv.docNo,
            idt: toPortalDate(inv.docDate),
            val: inv.invoiceValue,
            itms: inv.items.map((it, i) => ({
                num: i + 1,
                itm_det: { rt: it.rate, txval: it.taxableValue, iamt: it.igst, csamt: it.cess },
            })),
        })),
    }));

    // B2CS — flat rate-wise rows.
    const b2cs = report.b2cs.map(r => ({
        sply_ty: r.supplyType === 'INTER' ? 'INTER' : 'INTRA',
        pos: r.placeOfSupply,
        typ: 'OE',
        rt: r.rate,
        txval: r.taxableValue,
        iamt: r.igst,
        camt: r.cgst,
        samt: r.sgst,
        csamt: r.cess,
    }));

    // CDNR — grouped by recipient GSTIN.
    const cdnrByCtin = new Map<string, Gstr1Invoice[]>();
    for (const inv of report.cdnr) {
        const list = cdnrByCtin.get(inv.customerGstin) || [];
        list.push(inv);
        cdnrByCtin.set(inv.customerGstin, list);
    }
    const cdnr = [...cdnrByCtin.entries()].map(([ctin, notes]) => ({
        ctin,
        nt: notes.map(n => ({
            ntty: 'C',
            nt_num: n.docNo,
            nt_dt: toPortalDate(n.docDate),
            val: n.invoiceValue,
            pos: n.placeOfSupply,
            rchrg: n.reverseCharge ? 'Y' : 'N',
            inv_typ: 'R',
            itms: n.items.map((it, i) => ({
                num: i + 1,
                itm_det: {
                    rt: it.rate,
                    txval: it.taxableValue,
                    iamt: it.igst,
                    camt: it.cgst,
                    samt: it.sgst,
                    csamt: it.cess,
                },
            })),
        })),
    }));

    const hsn = {
        data: report.hsn.map((r, i) => ({
            num: i + 1,
            hsn_sc: r.hsnCode,
            desc: r.description,
            uqc: r.uqc,
            qty: r.totalQty,
            rt: r.rate,
            txval: r.taxableValue,
            iamt: r.igst,
            camt: r.cgst,
            samt: r.sgst,
            csamt: r.cess,
            val: r.totalValue,
        })),
    };

    const doc_issue = {
        doc_det: report.docs.map((d, i) => ({
            doc_num: i + 12,
            docs: [
                {
                    num: i + 1,
                    from: d.fromSerial,
                    to: d.toSerial,
                    totnum: d.totalCount,
                    cancel: d.cancelledCount,
                    net_issue: d.netIssued,
                },
            ],
        })),
    };

    const envelope: Record<string, unknown> = { gstin, fp: report.filingPeriod, version: 'GST3.1', hash: 'hash' };
    if (b2b.length) envelope.b2b = b2b;
    if (b2cl.length) envelope.b2cl = b2cl;
    if (b2cs.length) envelope.b2cs = b2cs;
    if (cdnr.length) envelope.cdnr = cdnr;
    if (hsn.data.length) envelope.hsn = hsn;
    if (doc_issue.doc_det.length) envelope.doc_issue = doc_issue;
    return envelope;
}

// ───────────────────────── CSV builders ─────────────────────────

/** RFC-4180-ish CSV cell escaping. */
function csvCell(v: unknown): string {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: Array<Array<unknown>>): string {
    return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

export interface GstCsvFile {
    section: string;
    filename: string;
    content: string;
}

/** One review CSV per GSTR-1 section (mirrors the structured report). */
export function buildGstr1Csvs(report: Gstr1Report): GstCsvFile[] {
    const fp = report.filingPeriod || 'period';
    const files: GstCsvFile[] = [];

    const invoiceRows = (invoices: Gstr1Invoice[]) => {
        const out: Array<Array<unknown>> = [
            ['GSTIN/UIN', 'Receiver Name', 'Invoice No', 'Invoice Date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
        ];
        for (const inv of invoices) {
            for (const it of inv.items) {
                out.push([inv.customerGstin, inv.customerName, inv.docNo, toPortalDate(inv.docDate), inv.invoiceValue, inv.placeOfSupply, inv.reverseCharge ? 'Y' : 'N', it.rate, it.taxableValue, it.igst, it.cgst, it.sgst, it.cess]);
            }
        }
        return out;
    };

    if (report.b2b.length) files.push({ section: 'b2b', filename: `gstr1-b2b-${fp}.csv`, content: csv(invoiceRows(report.b2b)) });
    if (report.b2cl.length) files.push({ section: 'b2cl', filename: `gstr1-b2cl-${fp}.csv`, content: csv(invoiceRows(report.b2cl)) });

    if (report.b2cs.length) {
        const rows: Array<Array<unknown>> = [['Type', 'Place Of Supply', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess']];
        for (const r of report.b2cs) rows.push([r.supplyType, r.placeOfSupply, r.rate, r.taxableValue, r.igst, r.cgst, r.sgst, r.cess]);
        files.push({ section: 'b2cs', filename: `gstr1-b2cs-${fp}.csv`, content: csv(rows) });
    }

    if (report.cdnr.length) {
        const rows: Array<Array<unknown>> = [['GSTIN/UIN', 'Receiver Name', 'Note No', 'Note Date', 'Note Type', 'Note Value', 'Place Of Supply', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess']];
        for (const inv of report.cdnr) {
            for (const it of inv.items) rows.push([inv.customerGstin, inv.customerName, inv.docNo, toPortalDate(inv.docDate), 'C', inv.invoiceValue, inv.placeOfSupply, it.rate, it.taxableValue, it.igst, it.cgst, it.sgst, it.cess]);
        }
        files.push({ section: 'cdnr', filename: `gstr1-cdnr-${fp}.csv`, content: csv(rows) });
    }

    if (report.hsn.length) {
        const rows: Array<Array<unknown>> = [['HSN', 'Description', 'UQC', 'Total Quantity', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess', 'Total Value']];
        for (const r of report.hsn) rows.push([r.hsnCode, r.description, r.uqc, r.totalQty, r.rate, r.taxableValue, r.igst, r.cgst, r.sgst, r.cess, r.totalValue]);
        files.push({ section: 'hsn', filename: `gstr1-hsn-${fp}.csv`, content: csv(rows) });
    }

    if (report.docs.length) {
        const rows: Array<Array<unknown>> = [['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled', 'Net Issued']];
        for (const d of report.docs) rows.push([d.natureOfDocument, d.fromSerial, d.toSerial, d.totalCount, d.cancelledCount, d.netIssued]);
        files.push({ section: 'docs', filename: `gstr1-docs-${fp}.csv`, content: csv(rows) });
    }

    return files;
}

/** Single review CSV for GSTR-3B. */
export function buildGstr3bCsv(report: Gstr3bReport): GstCsvFile {
    const rows: Array<Array<unknown>> = [['Section', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess']];
    for (const r of [...report.outward, ...report.itc, report.netTaxPayable]) {
        rows.push([r.label, r.taxableValue, r.igst, r.cgst, r.sgst, r.cess]);
    }
    return { section: '3b', filename: `gstr3b-${report.filingPeriod || 'period'}.csv`, content: csv(rows) };
}
