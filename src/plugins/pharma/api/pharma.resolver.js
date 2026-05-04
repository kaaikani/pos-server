import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx } from '@vendure/core';
import { PharmaService } from '../services/pharma.service';

@Resolver()
export class PharmaResolver {
    constructor(@Inject(PharmaService) svc) { this.svc = svc; }

    // ── Items ──
    @Query() async pharmaItems(@Ctx() ctx) { return this.svc.listItems(ctx); }
    @Query() async pharmaItem(@Ctx() ctx, @Args('id') id) { return this.svc.getItem(ctx, id); }
    @Mutation() async createPharmaItem(@Ctx() ctx, @Args() args) { return this.svc.createItem(ctx, args.input); }
    @Mutation() async updatePharmaItem(@Ctx() ctx, @Args('id') id, @Args() args) { return this.svc.updateItem(ctx, id, args.input); }
    @Mutation() async deletePharmaItem(@Ctx() ctx, @Args('id') id) { return this.svc.deleteItem(ctx, id); }

    // ── Purchases ──
    @Query() async pharmaPurchases(@Ctx() ctx) { return this.svc.listPurchases(ctx); }
    @Mutation() async createPharmaPurchase(@Ctx() ctx, @Args() args) { return this.svc.createPurchase(ctx, args.input); }
    @Mutation() async deletePharmaPurchase(@Ctx() ctx, @Args('id') id) { return this.svc.deletePurchase(ctx, id); }

    // ── Payments ──
    @Query() async pharmaPayments(@Ctx() ctx) { return this.svc.listPayments(ctx); }
    @Mutation() async createPharmaPayment(@Ctx() ctx, @Args() args) { return this.svc.createPayment(ctx, args.input); }
    @Mutation() async deletePharmaPayment(@Ctx() ctx, @Args('id') id) { return this.svc.deletePayment(ctx, id); }

    // ── Receipts ──
    @Query() async pharmaReceipts(@Ctx() ctx) { return this.svc.listReceipts(ctx); }
    @Mutation() async createPharmaReceipt(@Ctx() ctx, @Args() args) { return this.svc.createReceipt(ctx, args.input); }
    @Mutation() async deletePharmaReceipt(@Ctx() ctx, @Args('id') id) { return this.svc.deleteReceipt(ctx, id); }

    // ── Tokens ──
    @Query() async pharmaTokens(@Ctx() ctx, @Args('tokenDate') tokenDate) { return this.svc.listTokens(ctx, tokenDate); }
    @Mutation() async createPharmaToken(@Ctx() ctx, @Args() args) { return this.svc.createToken(ctx, args.input); }
    @Mutation() async deletePharmaToken(@Ctx() ctx, @Args('id') id) { return this.svc.deleteToken(ctx, id); }

    // ── Sales ──
    @Query() async pharmaSales(@Ctx() ctx, @Args('fromDate') fromDate, @Args('toDate') toDate) { return this.svc.listSales(ctx, fromDate, toDate); }
    @Query() async pharmaSale(@Ctx() ctx, @Args('id') id) { return this.svc.getSale(ctx, id); }
    @Mutation() async createPharmaSale(@Ctx() ctx, @Args() args) { return this.svc.createSale(ctx, args.input); }
    @Mutation() async deletePharmaSale(@Ctx() ctx, @Args('id') id) { return this.svc.deleteSale(ctx, id); }
}
