/**
 * EAN-13 barcode helpers — pure, server-authoritative. The POS generates and
 * validates barcodes on the backend (single source of truth); the frontend only
 * renders the value. EAN-13 = 12 data digits + 1 mod-10 check digit.
 *
 * Internal (store-assigned) codes use the GS1 "restricted distribution" prefix
 * range 20–29, which is reserved for in-store use and will never collide with a
 * real manufacturer GS1 barcode.
 */

/** Default in-store prefix (GS1 restricted distribution 20–29). */
export const INTERNAL_EAN_PREFIX = '20';

/** Compute the EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string): number {
    if (!/^\d{12}$/.test(first12)) {
        throw new Error('ean13CheckDigit expects exactly 12 digits.');
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const d = first12.charCodeAt(i) - 48;
        // Positions are 1-based: odd positions (index 0,2,…) weight 1, even weight 3.
        sum += i % 2 === 0 ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
}

/** Append the correct check digit to a 12-digit body → full 13-digit EAN-13. */
export function buildEan13(first12: string): string {
    return first12 + String(ean13CheckDigit(first12));
}

/** True only for a syntactically valid 13-digit EAN-13 with a correct check digit. */
export function isValidEan13(code: string): boolean {
    const c = String(code || '').trim();
    if (!/^\d{13}$/.test(c)) return false;
    return ean13CheckDigit(c.slice(0, 12)) === c.charCodeAt(12) - 48;
}

/**
 * Build a deterministic in-store EAN-13 for an item id:
 *   prefix(2) + zero-padded item id(10) + check(1).
 * Deterministic so the same item regenerates the same code unless it collides.
 */
export function ean13ForItemId(itemId: number, prefix = INTERNAL_EAN_PREFIX): string {
    const body = String(Math.abs(Math.trunc(itemId))).padStart(10, '0').slice(-10);
    return buildEan13(`${prefix}${body}`);
}

/** Build a random in-store EAN-13 (collision fallback). */
export function randomEan13(prefix = INTERNAL_EAN_PREFIX, rnd: () => number = Math.random): string {
    let body = '';
    for (let i = 0; i < 10; i++) body += Math.floor(rnd() * 10);
    return buildEan13(`${prefix}${body}`);
}
