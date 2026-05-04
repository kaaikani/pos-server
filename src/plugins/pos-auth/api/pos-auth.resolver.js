import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx } from '@vendure/core';
import { PosAuthService } from '../services/pos-auth.service';

@Resolver()
export class PosAuthResolver {
    constructor(@Inject(PosAuthService) posAuthService) {
        this.posAuthService = posAuthService;
    }

    @Query()
    async posUsers(@Ctx() ctx) {
        return this.posAuthService.listUsers(ctx);
    }

    @Query()
    async posValidateToken(@Ctx() ctx, @Args('token') token) {
        return this.posAuthService.validateToken(ctx, token);
    }

    @Mutation()
    async posLogin(@Ctx() ctx, @Args('username') username, @Args('password') password, @Args('loginRole') loginRole) {
        return this.posAuthService.login(ctx, username, password, loginRole);
    }

    @Mutation()
    async posCreateUser(@Ctx() ctx, @Args() args) {
        return this.posAuthService.createUser(ctx, args.input);
    }

    @Mutation()
    async posUpdateUser(@Ctx() ctx, @Args('id') id, @Args() args) {
        return this.posAuthService.updateUser(ctx, id, args.input);
    }

    @Mutation()
    async posDeleteUser(@Ctx() ctx, @Args('id') id) {
        return this.posAuthService.deleteUser(ctx, id);
    }
}
