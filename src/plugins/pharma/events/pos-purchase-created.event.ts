import { RequestContext, VendureEvent } from '@vendure/core';
import { PharmaPurchase } from '../entities/pharma-purchase.entity';

export class PosPurchaseCreatedEvent extends VendureEvent {
    constructor(public ctx: RequestContext, public purchase: PharmaPurchase) {
        super();
    }
}
