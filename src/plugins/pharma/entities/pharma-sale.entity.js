import { VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class PharmaSale extends VendureEntity {
    constructor(input) { super(input); }
    @Column({ type: 'varchar' }) billNo;
    @Column({ type: 'varchar' }) billDate;
    @Column({ type: 'varchar', default: '' }) billTime;
    @Column({ type: 'varchar', default: 'CASH' }) saleType;  // CASH | CREDIT | CARD | UPI
    @Column({ type: 'varchar', default: '' }) bookNo;
    @Column({ type: 'varchar', default: '' }) billRef;

    // Customer details
    @Column({ type: 'varchar', default: 'Walk-in' }) customerName;
    @Column({ type: 'varchar', default: '' }) customerPhone;
    @Column({ type: 'varchar', default: '' }) customerAddress;
    @Column({ type: 'varchar', default: '' }) salesMan;

    // Items (stored as JSON)
    @Column({ type: 'text', default: '[]' }) itemsJson;

    // Financial
    @Column({ type: 'float', default: 0 }) subtotal;
    @Column({ type: 'float', default: 0 }) taxAmount;
    @Column({ type: 'float', default: 0 }) discount;
    @Column({ type: 'float', default: 0 }) transportCharges;
    @Column({ type: 'float', default: 0 }) grandTotal;

    // Payment split
    @Column({ type: 'float', default: 0 }) cashAmount;
    @Column({ type: 'float', default: 0 }) upiAmount;
    @Column({ type: 'float', default: 0 }) cardAmount;
    @Column({ type: 'float', default: 0 }) receivedAmount;
    @Column({ type: 'float', default: 0 }) balanceDue;
    @Column({ type: 'float', default: 0 }) changeReturned;

    @Column({ type: 'varchar', default: '' }) remarks;
}
