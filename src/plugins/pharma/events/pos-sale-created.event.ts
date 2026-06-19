import { RequestContext, VendureEvent } from '@vendure/core';
import { PharmaSale } from '../entities/pharma-sale.entity';

export class PosSaleCreatedEvent extends VendureEvent {
    constructor(public ctx: RequestContext, public sale: PharmaSale) {
        super();
    }
}
