import { VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class PharmaItem extends VendureEntity {
    constructor(input) { super(input); }
    @Column({ type: 'varchar', default: '' }) code;
    @Column({ type: 'varchar' }) itemName;
    @Column({ type: 'varchar', default: '' }) tamilName;
    @Column({ type: 'varchar', default: 'Na' }) category;
    @Column({ type: 'varchar', default: 'General' }) groupName;
    @Column({ type: 'varchar', default: '' }) brand;
    @Column({ type: 'varchar', default: '' }) hsnCode;
    @Column({ type: 'varchar', default: '' }) barcode;
    @Column({ type: 'varchar', default: '' }) upcCode;
    @Column({ type: 'varchar', default: 'NA' }) unit;
    @Column({ type: 'varchar', default: '' }) packingUnit;
    @Column({ type: 'varchar', default: '' }) size;
    @Column({ type: 'varchar', default: 'GST 5%' }) taxName;
    @Column({ type: 'varchar', default: '' }) mfr;
    @Column({ type: 'float', default: 0 }) purchaseRate;
    @Column({ type: 'float', default: 0 }) salesRate;
    @Column({ type: 'float', default: 0 }) mrpRate;
    @Column({ type: 'float', default: 0 }) costRate;
    @Column({ type: 'float', default: 0 }) cRate;
    @Column({ type: 'float', default: 0 }) rateA;
    @Column({ type: 'float', default: 0 }) rateB;
    @Column({ type: 'float', default: 0 }) rateC;
    @Column({ type: 'float', default: 0 }) rateD;
    @Column({ type: 'float', default: 0 }) lastPurchaseRate;
    @Column({ type: 'float', default: 0 }) lastSaleRate;
    @Column({ type: 'float', default: 5 }) gstPercent;
    @Column({ type: 'float', default: 0 }) discount;
    @Column({ type: 'float', default: 0 }) profitMargin;
    @Column({ type: 'float', default: 0 }) incentivePct;
    @Column({ type: 'varchar', default: '' }) batchNo;
    @Column({ type: 'varchar', default: '' }) mfgDate;
    @Column({ type: 'varchar', default: '' }) expiryDate;
    @Column({ type: 'varchar', default: '' }) serialNo;
    @Column({ type: 'float', default: 0 }) minStock;
    @Column({ type: 'float', default: 0 }) maxStock;
    @Column({ type: 'float', default: 0 }) minStkQty;
    @Column({ type: 'float', default: 0 }) maxStkQty;
    @Column({ type: 'boolean', default: false }) isWeightBased;
    @Column({ type: 'boolean', default: true }) isExpiryEnabled;
    @Column({ type: 'boolean', default: false }) allowExpiry;
    @Column({ type: 'text', default: '[]' }) sizesJson; // JSON of {size, rate}
}
