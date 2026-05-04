import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Ledger } from './entities/ledger.entity';
import { LedgerPayment } from './entities/ledger-payment.entity';
import { LedgerService } from './services/ledger.service';
import { LedgerAdminResolver } from './api/ledger.resolver';
import { ledgerApiExtensions } from './api/ledger.api';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Ledger, LedgerPayment],
    providers: [LedgerService],
    adminApiExtensions: {
        schema: ledgerApiExtensions,
        resolvers: [LedgerAdminResolver]
    }
})
export class LedgerPlugin {}
