import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { pharmaApiExtensions } from './api/pharma.api';
import { PharmaResolver, PosExpenseEntityResolver } from './api/pharma.resolver';
import { PharmaItem } from './entities/pharma-item.entity';
import { PharmaPayment } from './entities/pharma-payment.entity';
import { PharmaPurchase } from './entities/pharma-purchase.entity';
import { PharmaReceipt } from './entities/pharma-receipt.entity';
import { PharmaSale } from './entities/pharma-sale.entity';
import { PharmaToken } from './entities/pharma-token.entity';
import { PosCompany } from './entities/pos-company.entity';
import { PosExpenseCategory } from './entities/pos-expense-category.entity';
import { PosExpenseItem } from './entities/pos-expense-item.entity';
import { PosExpense } from './entities/pos-expense.entity';
import { PosItemBarcode } from './entities/pos-item-barcode.entity';
import { PosItemPriceTier } from './entities/pos-item-price-tier.entity';
import { PosItemStockSnapshot } from './entities/pos-item-stock-snapshot.entity';
import { PosItemUnit } from './entities/pos-item-unit.entity';
import { PosTaxMaster } from './entities/pos-tax-master.entity';
import { PosPurchaseOrder } from './entities/pos-purchase-order.entity';
import { PosPurchaseReturn } from './entities/pos-purchase-return.entity';
import { PosSalesReturn } from './entities/pos-sales-return.entity';
import { PosSetting } from './entities/pos-setting.entity';
import { PosStockAdjustment } from './entities/pos-stock-adjustment.entity';
import { PosStockLedger } from './entities/pos-stock-ledger.entity';
import { PosUnit } from './entities/pos-unit.entity';
import { PharmaService } from './services/pharma.service';
import { VendureForwardSyncService } from './vendure-forward-sync.service';
import { VendureReverseSyncService } from './vendure-reverse-sync.service';

@VendurePlugin({
    compatibility: '^3.0.0',
    imports: [PluginCommonModule],
    entities: [
        PharmaItem,
        PharmaPurchase,
        PharmaPayment,
        PharmaReceipt,
        PharmaToken,
        PharmaSale,
        PosUnit,
        PosItemPriceTier,
        PosStockAdjustment,
        PosPurchaseReturn,
        PosPurchaseOrder,
        PosCompany,
        PosExpenseCategory,
        PosExpenseItem,
        PosExpense,
        PosStockLedger,
        PosItemStockSnapshot,
        PosTaxMaster,
        PosItemBarcode,
        PosSalesReturn,
        PosSetting,
        PosItemUnit,
    ],
    providers: [PharmaService, VendureReverseSyncService, VendureForwardSyncService],
    adminApiExtensions: {
        schema: pharmaApiExtensions,
        resolvers: [PharmaResolver, PosExpenseEntityResolver],
    },
    dashboard: './dashboard/index',
})
export class PharmaPlugin {}
