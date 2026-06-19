import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { ledgerApiExtensions } from './api/ledger.api';
import { LedgerAdminResolver } from './api/ledger.resolver';
import { LedgerPayment } from './entities/ledger-payment.entity';
import { Ledger } from './entities/ledger.entity';
import { LedgerService } from './services/ledger.service';

@VendurePlugin({
    compatibility: '^3.0.0',
    imports: [PluginCommonModule],
    entities: [Ledger, LedgerPayment],
    providers: [LedgerService],
    adminApiExtensions: {
        schema: ledgerApiExtensions,
        resolvers: [LedgerAdminResolver],
    },
})
export class LedgerPlugin {}
