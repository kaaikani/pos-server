import { Inject } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { PharmaItem } from '../entities/pharma-item.entity';
import { PharmaPayment } from '../entities/pharma-payment.entity';
import { PharmaPurchase } from '../entities/pharma-purchase.entity';
import { PharmaReceipt } from '../entities/pharma-receipt.entity';
import { PharmaSale } from '../entities/pharma-sale.entity';
import { PharmaToken } from '../entities/pharma-token.entity';
import { PosCompany } from '../entities/pos-company.entity';
import { PosExpenseCategory } from '../entities/pos-expense-category.entity';
import { PosExpenseItem } from '../entities/pos-expense-item.entity';
import { PosExpense } from '../entities/pos-expense.entity';
import { PosItemPriceTier } from '../entities/pos-item-price-tier.entity';
import { PosPurchaseOrder } from '../entities/pos-purchase-order.entity';
import { PosPurchaseReturn } from '../entities/pos-purchase-return.entity';
import { PosStockAdjustment } from '../entities/pos-stock-adjustment.entity';
import { PosUnit } from '../entities/pos-unit.entity';
import {
    CreatePharmaItemInput,
    CreatePharmaPaymentInput,
    CreatePharmaPurchaseInput,
    CreatePharmaReceiptInput,
    CreatePharmaSaleInput,
    CreatePharmaTokenInput,
    CreatePosCompanyInput,
    CreatePosExpenseCategoryInput,
    CreatePosExpenseInput,
    CreatePosExpenseItemInput,
    CreatePosItemPriceTierInput,
    CreatePosPurchaseOrderInput,
    CreatePosPurchaseReturnInput,
    CreatePosStockAdjustmentInput,
    CreatePosUnitInput,
    PharmaService,
} from '../services/pharma.service';
import { PurchaseOrderStatus } from '../types/pos-types';

@Resolver()
export class PharmaResolver {
    constructor(@Inject(PharmaService) private svc: PharmaService) {}

    // ── Items ──
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaItems(@Ctx() ctx: RequestContext): Promise<PharmaItem[]> {
        return this.svc.listItems(ctx);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaItem(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<PharmaItem | null> {
        return this.svc.getItem(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPharmaItem(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePharmaItemInput & { sizes?: unknown[] } },
    ): Promise<PharmaItem> {
        return this.svc.createItem(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async updatePharmaItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args() args: { input: Partial<CreatePharmaItemInput> & { sizes?: unknown[] } },
    ): Promise<PharmaItem> {
        return this.svc.updateItem(ctx, id, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async deletePharmaItem(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.svc.deleteItem(ctx, id);
    }

    // ── Purchases ──
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaPurchases(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate?: string; toDate?: string },
    ): Promise<PharmaPurchase[]> {
        return this.svc.listPurchases(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPharmaPurchase(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePharmaPurchaseInput },
    ): Promise<PharmaPurchase> {
        return this.svc.createPurchase(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async deletePharmaPurchase(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.svc.deletePurchase(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async cancelPharmaPurchase(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args('reason') reason?: string,
    ): Promise<PharmaPurchase> {
        return this.svc.cancelPurchase(ctx, id, reason);
    }

    // ── Payments ──
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaPayments(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate?: string; toDate?: string },
    ): Promise<PharmaPayment[]> {
        return this.svc.listPayments(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPharmaPayment(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePharmaPaymentInput },
    ): Promise<PharmaPayment> {
        return this.svc.createPayment(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async deletePharmaPayment(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.svc.deletePayment(ctx, id);
    }

    // ── Receipts ──
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaReceipts(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate?: string; toDate?: string },
    ): Promise<PharmaReceipt[]> {
        return this.svc.listReceipts(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPharmaReceipt(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePharmaReceiptInput },
    ): Promise<PharmaReceipt> {
        return this.svc.createReceipt(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async deletePharmaReceipt(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.svc.deleteReceipt(ctx, id);
    }

    // ── Tokens ──
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaTokens(
        @Ctx() ctx: RequestContext,
        @Args('tokenDate') tokenDate?: string,
    ): Promise<PharmaToken[]> {
        return this.svc.listTokens(ctx, tokenDate);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPharmaToken(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePharmaTokenInput },
    ): Promise<PharmaToken> {
        return this.svc.createToken(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async deletePharmaToken(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.svc.deleteToken(ctx, id);
    }

    // ── Sales ──
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaSales(
        @Ctx() ctx: RequestContext,
        @Args('fromDate') fromDate?: string,
        @Args('toDate') toDate?: string,
    ): Promise<PharmaSale[]> {
        return this.svc.listSales(ctx, fromDate, toDate);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaSale(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<PharmaSale | null> {
        return this.svc.getSale(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaSaleByBillNo(
        @Ctx() ctx: RequestContext,
        @Args('billNo') billNo: string,
    ): Promise<PharmaSale | null> {
        return this.svc.getSaleByBillNo(ctx, billNo);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaSalesReport(
        @Ctx() ctx: RequestContext,
        @Args('fromDate') fromDate?: string,
        @Args('toDate') toDate?: string,
    ): Promise<unknown> {
        return this.svc.getSalesReport(ctx, fromDate, toDate);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaCurrentStock(
        @Ctx() ctx: RequestContext,
        @Args('onlyLowStock') onlyLowStock?: boolean,
        @Args('onlyStockBased') onlyStockBased?: boolean,
    ): Promise<unknown> {
        return this.svc.getCurrentStock(ctx, onlyLowStock, onlyStockBased);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPharmaSale(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePharmaSaleInput },
    ): Promise<PharmaSale> {
        return this.svc.createSale(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async deletePharmaSale(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.svc.deleteSale(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async cancelPharmaSale(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args('reason') reason?: string,
    ): Promise<PharmaSale> {
        return this.svc.cancelSale(ctx, id, reason);
    }

    // ───── Stock Ledger (M1) ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posStockLedger(
        @Ctx() ctx: RequestContext,
        @Args('itemCode') itemCode?: string,
        @Args('refType') refType?: string,
        @Args('limit') limit?: number,
    ): Promise<unknown> {
        return this.svc.listStockLedger(ctx, { itemCode, refType, limit });
    }
    @Allow(Permission.Authenticated)
    @Query()
    async posItemStockSnapshots(@Ctx() ctx: RequestContext): Promise<unknown> {
        return this.svc.listStockSnapshots(ctx);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async posStockReconciliation(@Ctx() ctx: RequestContext): Promise<unknown> {
        return this.svc.getStockReconciliation(ctx);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async posStockIntegrityReport(@Ctx() ctx: RequestContext): Promise<unknown> {
        return this.svc.getStockIntegrityReport(ctx);
    }

    // ───── M2 — TaxMaster + ItemBarcode + Auto-fill ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posTaxMasters(@Ctx() ctx: RequestContext): Promise<unknown> {
        return this.svc.listTaxMasters(ctx);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosTaxMaster(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { code: string; name: string; ratePercent: number; taxType: any; isDefault?: boolean } },
    ): Promise<unknown> {
        return this.svc.createTaxMaster(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async updatePosTaxMaster(
        @Ctx() ctx: RequestContext,
        @Args()
        args: {
            id: string;
            input: { code?: string; name?: string; ratePercent?: number; taxType?: any; isDefault?: boolean };
        },
    ): Promise<unknown> {
        return this.svc.updateTaxMaster(ctx, args.id, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async deletePosTaxMaster(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<unknown> {
        return this.svc.deleteTaxMaster(ctx, id);
    }

    @Allow(Permission.Authenticated)
    @Query()
    async posItemBarcodes(
        @Ctx() ctx: RequestContext,
        @Args('itemId') itemId: string,
    ): Promise<unknown> {
        return this.svc.listItemBarcodes(ctx, itemId);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async addPosItemBarcode(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { itemId: number; barcode: string; isPrimary?: boolean } },
    ): Promise<unknown> {
        return this.svc.addItemBarcode(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async removePosItemBarcode(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<boolean> {
        return this.svc.removeItemBarcode(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async generatePosItemBarcode(
        @Ctx() ctx: RequestContext,
        @Args('itemId') itemId: string,
    ): Promise<unknown> {
        return this.svc.generateItemBarcode(ctx, itemId);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async generateMissingPosItemBarcodes(@Ctx() ctx: RequestContext): Promise<unknown> {
        return this.svc.generateMissingItemBarcodes(ctx);
    }

    @Allow(Permission.Authenticated)
    @Query()
    async pharmaItemForTransaction(
        @Ctx() ctx: RequestContext,
        @Args('code') code?: string,
        @Args('barcode') barcode?: string,
    ): Promise<unknown> {
        return this.svc.pharmaItemForTransaction(ctx, { code, barcode });
    }

    // ───── Upgrade A — PosItemUnit (N transaction units per item) ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posItemUnits(
        @Ctx() ctx: RequestContext,
        @Args('itemId') itemId: string,
    ): Promise<unknown> {
        return this.svc.listItemUnits(ctx, itemId);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async addPosItemUnit(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { itemId: number; unitCode: string; conversionRate: number; isBase?: boolean } },
    ): Promise<unknown> {
        return this.svc.addItemUnit(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async removePosItemUnit(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<boolean> {
        return this.svc.removeItemUnit(ctx, id);
    }

    // ───── M4 — Sales Return + Purchase Return upgrades ─────
    @Allow(Permission.Authenticated)
    @Query()
    async pharmaSalesByCustomer(
        @Ctx() ctx: RequestContext,
        @Args('customerPhone') customerPhone?: string,
        @Args('customerName') customerName?: string,
        @Args('limit') limit?: number,
    ): Promise<unknown> {
        return this.svc.listSalesByCustomer(ctx, { customerPhone, customerName, limit });
    }
    @Allow(Permission.Authenticated)
    @Query()
    async getSaleForReturn(
        @Ctx() ctx: RequestContext,
        @Args('saleId') saleId: string,
    ): Promise<unknown> {
        return this.svc.getSaleForReturn(ctx, saleId);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async posSalesReturns(
        @Ctx() ctx: RequestContext,
        @Args('originalSaleId') originalSaleId?: number,
        @Args('customerPhone') customerPhone?: string,
        @Args('includeCancelled') includeCancelled?: boolean,
    ): Promise<unknown> {
        return this.svc.listSalesReturns(ctx, { originalSaleId, customerPhone, includeCancelled });
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosSalesReturn(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: any },
    ): Promise<unknown> {
        return this.svc.createSalesReturn(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async cancelPosSalesReturn(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args('reason') reason?: string,
    ): Promise<unknown> {
        return this.svc.cancelSalesReturn(ctx, id, reason);
    }
    // ───── Fix 2 — Item soft-cancel ─────
    @Allow(Permission.Authenticated)
    @Mutation()
    async cancelPharmaItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args('reason') reason?: string,
    ): Promise<unknown> {
        return this.svc.cancelItem(ctx, id, reason);
    }

    // ───── Fix 1 — PosSetting ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posSetting(@Ctx() ctx: RequestContext): Promise<unknown> {
        return this.svc.getPosSetting(ctx);
    }
    @Allow(Permission.UpdateSettings)
    @Mutation()
    async updatePosSetting(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { allowNegativeStock?: boolean; allowReturnRateOverride?: boolean } },
    ): Promise<unknown> {
        return this.svc.updatePosSetting(ctx, args.input);
    }

    // ───── M5 — Vendure sync admin bootstrap ─────
    @Allow(Permission.SuperAdmin)
    @Mutation()
    async syncAllItemsToVendure(@Ctx() ctx: RequestContext): Promise<number> {
        return this.svc.syncAllItemsToVendure(ctx);
    }

    // Cleanup mutation — retroactively apply ledger reductions for
    // bug-period sales returns. Idempotent via PosSalesReturn.ledgerApplied.
    @Allow(Permission.SuperAdmin)
    @Mutation()
    async reconcileSalesReturnsToLedger(@Ctx() ctx: RequestContext): Promise<unknown> {
        return this.svc.reconcileSalesReturnsToLedger(ctx);
    }

    @Allow(Permission.Authenticated)
    @Query()
    async searchPurchasesForReturn(
        @Ctx() ctx: RequestContext,
        @Args('supplier') supplier?: string,
        @Args('itemCode') itemCode?: string,
        @Args('fromDate') fromDate?: string,
        @Args('toDate') toDate?: string,
        @Args('limit') limit?: number,
    ): Promise<unknown> {
        return this.svc.searchPurchasesForReturn(ctx, { supplier, itemCode, fromDate, toDate, limit });
    }

    // ───── POS UNIT ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posUnits(@Ctx() ctx: RequestContext): Promise<PosUnit[]> {
        return this.svc.listUnits(ctx);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosUnit(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosUnitInput },
    ): Promise<PosUnit> {
        return this.svc.createUnit(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async updatePosUnit(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args() args: { input: CreatePosUnitInput },
    ): Promise<PosUnit> {
        return this.svc.updateUnit(ctx, id, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosUnit(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<PosUnit> {
        return this.svc.cancelUnit(ctx, id);
    }

    // ───── POS ITEM PRICE TIER ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posItemPriceTiers(
        @Ctx() ctx: RequestContext,
        @Args('itemId') itemId: string,
    ): Promise<PosItemPriceTier[]> {
        return this.svc.listItemPriceTiers(ctx, itemId);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosItemPriceTier(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosItemPriceTierInput },
    ): Promise<PosItemPriceTier> {
        return this.svc.createItemPriceTier(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async updatePosItemPriceTier(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args() args: { input: CreatePosItemPriceTierInput },
    ): Promise<PosItemPriceTier> {
        return this.svc.updateItemPriceTier(ctx, id, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosItemPriceTier(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosItemPriceTier> {
        return this.svc.cancelItemPriceTier(ctx, id);
    }

    // ───── POS STOCK ADJUSTMENT ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posStockAdjustments(@Ctx() ctx: RequestContext): Promise<PosStockAdjustment[]> {
        return this.svc.listStockAdjustments(ctx);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosStockAdjustment(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosStockAdjustmentInput },
    ): Promise<PosStockAdjustment> {
        return this.svc.createStockAdjustment(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosStockAdjustment(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosStockAdjustment> {
        return this.svc.cancelStockAdjustment(ctx, id);
    }

    // ───── POS PURCHASE RETURN ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posPurchaseReturns(@Ctx() ctx: RequestContext): Promise<PosPurchaseReturn[]> {
        return this.svc.listPurchaseReturns(ctx);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosPurchaseReturn(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosPurchaseReturnInput },
    ): Promise<PosPurchaseReturn> {
        return this.svc.createPurchaseReturn(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosPurchaseReturn(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosPurchaseReturn> {
        return this.svc.cancelPurchaseReturn(ctx, id);
    }

    // ───── POS PURCHASE ORDER ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posPurchaseOrders(
        @Ctx() ctx: RequestContext,
        @Args('status') status?: PurchaseOrderStatus,
    ): Promise<PosPurchaseOrder[]> {
        return this.svc.listPurchaseOrders(ctx, status);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async posPurchaseOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosPurchaseOrder | null> {
        return this.svc.getPurchaseOrder(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosPurchaseOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosPurchaseOrderInput },
    ): Promise<PosPurchaseOrder> {
        return this.svc.createPurchaseOrder(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async updatePosPurchaseOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args() args: { input: CreatePosPurchaseOrderInput },
    ): Promise<PosPurchaseOrder> {
        return this.svc.updatePurchaseOrder(ctx, id, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosPurchaseOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosPurchaseOrder> {
        return this.svc.cancelPurchaseOrder(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async convertPosPurchaseOrderToPurchase(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PharmaPurchase> {
        return this.svc.convertPurchaseOrderToPurchase(ctx, id);
    }

    // ───── POS EXPENSE CATEGORY ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posExpenseCategories(@Ctx() ctx: RequestContext): Promise<PosExpenseCategory[]> {
        return this.svc.listExpenseCategories(ctx);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosExpenseCategory(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosExpenseCategoryInput },
    ): Promise<PosExpenseCategory> {
        return this.svc.createExpenseCategory(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async updatePosExpenseCategory(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args() args: { input: CreatePosExpenseCategoryInput },
    ): Promise<PosExpenseCategory> {
        return this.svc.updateExpenseCategory(ctx, id, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosExpenseCategory(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosExpenseCategory> {
        return this.svc.cancelExpenseCategory(ctx, id);
    }

    // ───── POS EXPENSE ITEM ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posExpenseItems(@Ctx() ctx: RequestContext): Promise<PosExpenseItem[]> {
        return this.svc.listExpenseItems(ctx);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosExpenseItem(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosExpenseItemInput },
    ): Promise<PosExpenseItem> {
        return this.svc.createExpenseItem(ctx, args.input);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async updatePosExpenseItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args() args: { input: CreatePosExpenseItemInput },
    ): Promise<PosExpenseItem> {
        return this.svc.updateExpenseItem(ctx, id, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosExpenseItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosExpenseItem> {
        return this.svc.cancelExpenseItem(ctx, id);
    }

    // ───── POS EXPENSE ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posExpenses(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate?: string; toDate?: string },
    ): Promise<PosExpense[]> {
        return this.svc.listExpenses(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async posExpense(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<PosExpense | null> {
        return this.svc.getExpense(ctx, id);
    }

    // ───── DAY BOOK ─────
    @Allow(Permission.Authenticated)
    @Query()
    async dayBook(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getDayBook(ctx, args.fromDate, args.toDate);
    }

    // ───── GST REPORT ─────
    @Allow(Permission.Authenticated)
    @Query()
    async gstReport(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getGstReport(ctx, args.fromDate, args.toDate);
    }

    // ───── GSTR-1 / GSTR-3B (filing returns) ─────
    @Allow(Permission.Authenticated)
    @Query()
    async gstr1Report(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getGstr1Report(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async gstr1PortalJson(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<string> {
        return this.svc.getGstr1PortalJson(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async gstr1Csvs(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getGstr1Csvs(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async gstr3bReport(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getGstr3bReport(ctx, args.fromDate, args.toDate);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async gstr3bCsv(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getGstr3bCsv(ctx, args.fromDate, args.toDate);
    }

    // ───── PURCHASE REPORT ─────
    @Allow(Permission.Authenticated)
    @Query()
    async purchaseReport(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getPurchaseReport(ctx, args.fromDate, args.toDate);
    }

    // ───── EXPENSE REPORT ─────
    @Allow(Permission.Authenticated)
    @Query()
    async expenseReport(
        @Ctx() ctx: RequestContext,
        @Args() args: { fromDate: string; toDate?: string },
    ): Promise<unknown> {
        return this.svc.getExpenseReport(ctx, args.fromDate, args.toDate);
    }

    // ───── POS COMPANY (seller GST identity) ─────
    @Allow(Permission.Authenticated)
    @Query()
    async posCompanies(@Ctx() ctx: RequestContext): Promise<PosCompany[]> {
        return this.svc.listCompanies(ctx);
    }
    @Allow(Permission.Authenticated)
    @Query()
    async posActiveCompany(@Ctx() ctx: RequestContext): Promise<PosCompany | null> {
        return this.svc.getActiveCompany(ctx);
    }
    @Allow(Permission.UpdateSettings)
    @Mutation()
    async createPosCompany(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosCompanyInput },
    ): Promise<PosCompany> {
        return this.svc.createCompany(ctx, args.input);
    }
    @Allow(Permission.UpdateSettings)
    @Mutation()
    async updatePosCompany(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: Partial<CreatePosCompanyInput> },
    ): Promise<PosCompany> {
        return this.svc.updateCompany(ctx, args.id, args.input);
    }
    @Allow(Permission.UpdateSettings)
    @Mutation()
    async setActivePosCompany(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosCompany> {
        return this.svc.setActiveCompany(ctx, id);
    }
    @Allow(Permission.UpdateSettings)
    @Mutation()
    async deletePosCompany(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosCompany> {
        return this.svc.deleteCompany(ctx, id);
    }
    @Allow(Permission.Authenticated)
    @Mutation()
    async createPosExpense(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosExpenseInput },
    ): Promise<PosExpense> {
        return this.svc.createExpense(ctx, args.input);
    }
    @Allow(Permission.DeleteCatalog)
    @Mutation()
    async cancelPosExpense(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<PosExpense> {
        return this.svc.cancelExpense(ctx, id);
    }
}

/** Computed-field resolver for PosExpense. */
@Resolver('PosExpense')
export class PosExpenseEntityResolver {
    @ResolveField()
    taxAmount(@Parent() e: PosExpense): number {
        const v = (Number(e.netAmount) || 0) - (Number(e.roundOff) || 0) - (Number(e.totalAmount) || 0);
        return Math.round(v * 100) / 100;
    }
}
