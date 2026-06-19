import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { PosUser } from '../entities/pos-user.entity';
import {
    CreatePosUserInput,
    LoginResult,
    PosAuthService,
    UpdatePosUserInput,
    ValidateTokenResult,
} from '../services/pos-auth.service';
import { PosUserRole } from '../entities/pos-user.entity';

@Resolver()
export class PosAuthResolver {
    constructor(@Inject(PosAuthService) private posAuthService: PosAuthService) {}

    @Allow(Permission.SuperAdmin)
    @Query()
    async posUsers(@Ctx() ctx: RequestContext): Promise<PosUser[]> {
        return this.posAuthService.listUsers(ctx);
    }

    @Allow(Permission.Public)
    @Query()
    async posValidateToken(
        @Ctx() ctx: RequestContext,
        @Args('token') token: string,
    ): Promise<ValidateTokenResult | null> {
        return this.posAuthService.validateToken(ctx, token);
    }

    @Allow(Permission.Public)
    @Mutation()
    async posLogin(
        @Ctx() ctx: RequestContext,
        @Args('username') username: string,
        @Args('password') password: string,
        @Args('loginRole') loginRole: PosUserRole,
    ): Promise<LoginResult> {
        return this.posAuthService.login(ctx, username, password, loginRole);
    }

    @Allow(Permission.SuperAdmin)
    @Mutation()
    async posCreateUser(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePosUserInput },
    ): Promise<PosUser> {
        return this.posAuthService.createUser(ctx, args.input);
    }

    @Allow(Permission.SuperAdmin)
    @Mutation()
    async posUpdateUser(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args() args: { input: UpdatePosUserInput },
    ): Promise<PosUser> {
        return this.posAuthService.updateUser(ctx, id, args.input);
    }

    @Allow(Permission.SuperAdmin)
    @Mutation()
    async posDeleteUser(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        return this.posAuthService.deleteUser(ctx, id);
    }
}
