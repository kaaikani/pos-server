import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PosUser } from './entities/pos-user.entity';
import { PosAuthService } from './services/pos-auth.service';
import { PosAuthResolver } from './api/pos-auth.resolver';
import { posAuthApiExtensions } from './api/pos-auth.api';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PosUser],
    providers: [PosAuthService],
    adminApiExtensions: {
        schema: posAuthApiExtensions,
        resolvers: [PosAuthResolver],
    },
})
export class PosAuthPlugin {}
