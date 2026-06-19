/**
 * Pure GST calculation helpers — the single source of truth for tax math.
 *
 * The same formulas must be mirrored on the POS frontend for live display, but
 * the values persisted on a sale / purchase are always the ones computed here
 * (server-authoritative). Nothing in this file touches the DB or RequestContext
 * so it can be unit-tested in isolation.
 *
 * India GST model:
 *  - Intra-state supply  → tax splits into CGST (rate/2) + SGST (rate/2)
 *  - Inter-state supply  → single IGST (full rate)            [interState = true]
 *  - Inclusive price     → the rate already contains the tax; we extract it and
 *                          DO NOT add it on top of the displayed total.
 *  - Exclusive price     → tax is added on top of the rate.
 */

/** Round to 2 decimals, killing float noise like 12.000000001. */
export function round2(n: number): number {
    return Math.round((Number(n) || 0) * 100) / 100;
}

export interface LineTaxInput {
    /** Per-unit rate (sales rate or purchase rate). */
    rate: number;
    qty: number;
    /** GST slab percent, e.g. 5, 12, 18. */
    gstPercent: number;
    /** Does `rate` already include the tax? */
    inclusive: boolean;
    /** true → IGST (inter-state); false → CGST + SGST (intra-state). */
    interState: boolean;
    /** Optional flat discount applied to the line (gross qty*rate) before tax. */
    discountFlat?: number;
    /** Optional percentage discount on the line, applied before flat discount. */
    discountPct?: number;
}

export interface LineTaxResult {
    /** rate * qty, before any discount. */
    gross: number;
    /** Total discount removed from the line. */
    discount: number;
    /** Net value the tax is computed on (after discount, tax extracted if inclusive). */
    taxable: number;
    gstPercent: number;
    cgst: number;
    sgst: number;
    igst: number;
    /** cgst + sgst + igst. */
    gstAmount: number;
    /** taxable + gstAmount — the line value shown on the bill (incl tax). */
    total: number;
}

/**
 * Compute the tax breakup for a single line.
 *
 * Mode-agnostic invariant: `total` always equals `taxable + gstAmount`, whether
 * the price was entered inclusive or exclusive. For inclusive lines the tax is
 * carved out of the price (total === gross-after-discount); for exclusive lines
 * the tax is stacked on top.
 */
export function computeLineTax(input: LineTaxInput): LineTaxResult {
    const rate = Number(input.rate) || 0;
    const qty = Number(input.qty) || 0;
    const gstPercent = Math.max(0, Number(input.gstPercent) || 0);
    const gross = round2(rate * qty);

    const pctDisc = gross * (Math.max(0, Number(input.discountPct) || 0) / 100);
    const flatDisc = Math.max(0, Number(input.discountFlat) || 0);
    const discount = round2(Math.min(gross, pctDisc + flatDisc));
    const base = round2(gross - discount);

    let taxable: number;
    let gstAmount: number;
    if (input.inclusive && gstPercent > 0) {
        // Price already contains the tax → extract it, don't add on top.
        taxable = round2((base * 100) / (100 + gstPercent));
        gstAmount = round2(base - taxable);
    } else {
        taxable = base;
        gstAmount = round2((base * gstPercent) / 100);
    }

    const interState = !!input.interState;
    const cgst = interState ? 0 : round2(gstAmount / 2);
    const sgst = interState ? 0 : round2(gstAmount - cgst); // absorb rounding remainder
    const igst = interState ? gstAmount : 0;

    return {
        gross,
        discount,
        taxable,
        gstPercent,
        cgst,
        sgst,
        igst,
        gstAmount,
        total: round2(taxable + gstAmount),
    };
}

export interface TaxSummary {
    /** Σ taxable value across all lines (pre-tax). */
    taxableTotal: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    /** Σ all GST (cgst + sgst + igst). */
    taxTotal: number;
    /** Σ line totals incl. tax (before bill-level discount / transport). */
    linesTotal: number;
    discountTotal: number;
}

/** Aggregate a set of per-line results into bill-level totals. */
export function summarizeTax(lines: LineTaxResult[]): TaxSummary {
    const s: TaxSummary = {
        taxableTotal: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        taxTotal: 0,
        linesTotal: 0,
        discountTotal: 0,
    };
    for (const l of lines) {
        s.taxableTotal += l.taxable;
        s.cgstTotal += l.cgst;
        s.sgstTotal += l.sgst;
        s.igstTotal += l.igst;
        s.taxTotal += l.gstAmount;
        s.linesTotal += l.total;
        s.discountTotal += l.discount;
    }
    s.taxableTotal = round2(s.taxableTotal);
    s.cgstTotal = round2(s.cgstTotal);
    s.sgstTotal = round2(s.sgstTotal);
    s.igstTotal = round2(s.igstTotal);
    s.taxTotal = round2(s.taxTotal);
    s.linesTotal = round2(s.linesTotal);
    s.discountTotal = round2(s.discountTotal);
    return s;
}
