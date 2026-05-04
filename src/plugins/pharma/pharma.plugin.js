import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PharmaItem } from './entities/pharma-item.entity';
import { PharmaPurchase } from './entities/pharma-purchase.entity';
import { PharmaPayment } from './entities/pharma-payment.entity';
import { PharmaReceipt } from './entities/pharma-receipt.entity';
import { PharmaToken } from './entities/pharma-token.entity';
import { PharmaSale } from './entities/pharma-sale.entity';
import { PharmaService } from './services/pharma.service';
import { PharmaResolver } from './api/pharma.resolver';
import { pharmaApiExtensions } from './api/pharma.api';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PharmaItem, PharmaPurchase, PharmaPayment, PharmaReceipt, PharmaToken, PharmaSale],
    providers: [PharmaService],
    adminApiExtensions: {
        schema: pharmaApiExtensions,
        resolvers: [PharmaResolver],
    },
})
export class PharmaPlugin {}
