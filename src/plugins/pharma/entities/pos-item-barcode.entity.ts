import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Multiple barcodes per item. Scanners may register any of an item's
 * configured barcodes; `pharmaItemForTransaction(barcode:..)` resolves the
 * item through this table.
 *
 * The primary barcode mirrors `PharmaItem.barcode` for back-compat reads.
 */
@Entity()
@Index('UQ_item_barcode', ['barcode'], { unique: true })
export class PosItemBarcode extends VendureEntity {
    constructor(input?: DeepPartial<PosItemBarcode>) {
        super(input);
    }

    @Column({ type: 'integer' }) itemId!: number;
    @Column({ type: 'varchar' }) barcode!: string;
    @Column({ type: 'boolean', default: false }) isPrimary!: boolean;
    @Column({ type: 'varchar', default: 'ACTIVE' }) status!: 'ACTIVE' | 'CANCELLED';
}
