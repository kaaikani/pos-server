import { Inject } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { Ledger, LedgerType } from '../entities/ledger.entity';
import { LedgerPayment } from '../entities/ledger-payment.entity';
import { CreateLedgerInput, LedgerService, PaymentInput } from '../services/ledger.service';

@Resolver('Ledger')
export class LedgerAdminResolver {
    constructor(
        @Inject(LedgerService) private ledgerService: LedgerService,
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
    ) {}

    @Allow(Permission.Authenticated)
    @Query()
    async ledgers(@Ctx() ctx: RequestContext, @Args('type') type: LedgerType): Promise<Ledger[]> {
        return this.ledgerService.findAll(ctx, type);
    }

    @Allow(Permission.Authenticated)
    @Query()
    async ledger(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<Ledger | null> {
        return this.ledgerService.findOne(ctx, id);
    }

    @Allow(Permission.Authenticated)
    @Query()
    async ledgerSummary(@Ctx() ctx: RequestContext) {
        return this.ledgerService.getSummary(ctx);
    }

    @Allow(Permission.Authenticated)
    @Mutation()
    async createLedger(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreateLedgerInput },
    ): Promise<Ledger> {
        return this.ledgerService.createLedger(ctx, args.input);
    }

    @Allow(Permission.DeleteCustomer)
    @Mutation()
    async deleteLedger(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.ledgerService.deleteLedger(ctx, id);
    }

    @Allow(Permission.Authenticated)
    @Mutation()
    async addPayment(
        @Ctx() ctx: RequestContext,
        @Args() args: { ledgerId: string; input: PaymentInput },
    ): Promise<Ledger> {
        return this.ledgerService.addPayment(ctx, args.ledgerId, args.input);
    }

    @ResolveField()
    async payments(@Ctx() ctx: RequestContext, @Parent() ledger: Ledger): Promise<LedgerPayment[]> {
        if (ledger.payments && ledger.payments.length > 0) {
            return ledger.payments;
        }
        // Direct FK lookup — using `ledgerId` (the column) is more reliable than
        // the nested `{ ledger: { id } }` form, which depends on TypeORM correctly
        // generating a JOIN and can return empty when relations aren't eager.
        return this.connection.getRepository(ctx, LedgerPayment).find({
            where: { ledgerId: parseInt(String(ledger.id), 10) },
            order: { createdAt: 'DESC' },
        });
    }
}
