import { bootstrap, runMigrations } from '@vendure/core';
import { config } from './vendure-config.ts';

// In dev (APP_ENV=dev) `synchronize` builds the schema from the entities, so running
// migrations on top would try to re-create existing tables and fail
// ("Table 'pos_company' already exists"). Run migrations only in production.
const IS_DEV = process.env.APP_ENV === 'dev';

(IS_DEV ? bootstrap(config) : runMigrations(config).then(() => bootstrap(config)))
    .catch(err => {
        console.log(err);
    });
