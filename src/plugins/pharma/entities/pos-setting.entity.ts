import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/**
 * Singleton config row for the whole POS backend. Service `getSetting()` lazily
 * creates one row with strict defaults on first read and caches it in memory.
 *
 * Adding new fields: ALWAYS use Column defaults that preserve current behaviour
 * so an existing instance keeps working without a manual settings update.
 *
 * Read by: `writeLedger()` (allowNegativeStock).
 */
@Entity()
export class PosSetting extends VendureEntity {
    constructor(input?: DeepPartial<PosSetting>) {
        super(input);
    }

    /**
     * When true, `writeLedger()` will NOT throw if a movement would push stock
     * below zero. Use for service businesses / backorder workflows.
     *
     * Strict default = false. Most stores want negative-stock prevention.
     */
    @Column({ type: 'boolean', default: false }) allowNegativeStock!: boolean;

    /**
     * When true, returns can re-use rates from the original invoice silently.
     * When false, the server forces original rate even if client supplies a
     * different one (current V1 behaviour locked).
     */
    @Column({ type: 'boolean', default: false }) allowReturnRateOverride!: boolean;

    /** Audit (someone may flip these). */
    @Column({ type: 'integer', nullable: true }) updatedByAdminId!: number | null;
}
