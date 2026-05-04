import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Ctx, TransactionalConnection } from '@vendure/core';
import { LedgerService } from '../services/ledger.service';
import { LedgerPayment } from '../entities/ledger-payment.entity';

@Resolver('Ledger')
export class LedgerAdminResolver {
    constructor(
        @Inject(LedgerService) ledgerService,
        @Inject(TransactionalConnection) connection,
    ) {
        this.ledgerService = ledgerService;
        this.connection = connection;
    }

    @Query()
    async ledgers(@Ctx() ctx, @Args('type') type) {
        return this.ledgerService.findAll(ctx, type);
    }

    @Query()
    async ledger(@Ctx() ctx, @Args('id') id) {
        return this.ledgerService.findOne(ctx, id);
    }

    @Query()
    async ledgerSummary(@Ctx() ctx) {
        return this.ledgerService.getSummary(ctx);
    }

    @Mutation()
    async createLedger(@Ctx() ctx, @Args() args) {
        return this.ledgerService.createLedger(ctx, args.input);
    }

    @Mutation()
    async deleteLedger(@Ctx() ctx, @Args('id') id) {
        return this.ledgerService.deleteLedger(ctx, id);
    }

    @Mutation()
    async addPayment(@Ctx() ctx, @Args() args) {
        return this.ledgerService.addPayment(ctx, args.ledgerId, args.input);
    }

    @ResolveField()
    async payments(@Ctx() ctx, @Parent() ledger) {
        if (ledger.payments && ledger.payments.length > 0) {
            return ledger.payments;
        }
        return this.connection.getRepository(ctx, LedgerPayment).find({
            where: { ledger: { id: ledger.id } },
            order: { createdAt: 'DESC' },
        });
    }
}
