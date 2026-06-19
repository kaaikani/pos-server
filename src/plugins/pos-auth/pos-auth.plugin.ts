import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { posAuthApiExtensions } from './api/pos-auth.api';
import { PosAuthResolver } from './api/pos-auth.resolver';
import { PosUser } from './entities/pos-user.entity';
import { PosAuthService } from './services/pos-auth.service';

@VendurePlugin({
    compatibility: '^3.0.0',
    imports: [PluginCommonModule],
    entities: [PosUser],
    providers: [PosAuthService],
    adminApiExtensions: {
        schema: posAuthApiExtensions,
        resolvers: [PosAuthResolver],
    },
})
export class PosAuthPlugin {}
