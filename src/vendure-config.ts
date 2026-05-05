import {
    dummyPaymentHandler,
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    LanguageCode,
    VendureConfig,
} from '@vendure/core';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import { LedgerPlugin } from './plugins/ledger/ledger.plugin';
import { PosAuthPlugin } from './plugins/pos-auth/pos-auth.plugin';
import { PharmaPlugin } from './plugins/pharma/pharma.plugin';
import 'dotenv/config';
import path from 'path';

const IS_DEV = process.env.APP_ENV === 'dev';
const serverPort = +process.env.PORT || 3000;

// CORS origins: comma-separated list in env (e.g. "http://localhost:3001,http://192.168.1.20:3001")
// In dev, fall back to "true" (allow any origin). In production, require explicit list.
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
    : (IS_DEV ? true : ['http://localhost:3001']);

export const config: VendureConfig = {
    apiOptions: {
        // Empty hostname → binds to all interfaces (default Nest behavior) AND lets
        // GraphiQL plugin emit a relative URL — avoids "NetworkError" when the browser
        // can't resolve a literal "0.0.0.0" host.
        // Override via env: HOSTNAME=127.0.0.1 if you want loopback-only.
        hostname: process.env.HOSTNAME || '',
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_DEV ? false : 1,
        // CORS: allow the storefront origin(s) to call admin-api / shop-api from the browser.
        cors: {
            origin: corsOrigins,
            credentials: true,
        },
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV ? {
            adminApiDebug: true,
            shopApiDebug: true,
            adminApiPlayground: { settings: { 'request.credentials': 'include' } },
            shopApiPlayground: { settings: { 'request.credentials': 'include' } },
        } : {}),
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
          secret: process.env.COOKIE_SECRET,
        },
    },
    dbConnectionOptions: {
        type: 'better-sqlite3',
        // See the README.md "Migrations" section for an explanation of
        // the `synchronize` and `migrations` options.
        synchronize: IS_DEV,
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: false,
        database: path.join(__dirname, '../vendure.sqlite'),
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {
        ProductVariant: [
            {
                name: 'barcode',
                type: 'string',
                description: [
                  { languageCode: LanguageCode.en , value: 'Physical Supermarket Barcode (EAN/UPC)' }
                ],
                ui: { component: 'text-form-input' },
                unique: false, // For safety across environments
            }
        ]
    },
    plugins: [
        GraphiqlPlugin.init({
            route: 'graphiql',
        }),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, '../static/assets'),
            // In dev, let Vendure auto-detect the prefix. In production set
            // ASSET_URL_PREFIX to your CDN/public host (e.g. https://cdn.example.com/assets/).
            assetUrlPrefix: IS_DEV ? undefined : process.env.ASSET_URL_PREFIX,
        }),
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            devMode: true,
            outputPath: path.join(__dirname, '../static/email/test-emails'),
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
            globalTemplateVars: (() => {
                const storefrontUrl = process.env.STOREFRONT_URL || 'http://localhost:3002';
                return {
                    fromAddress: process.env.EMAIL_FROM_ADDRESS || '"example" <noreply@example.com>',
                    verifyEmailAddressUrl: `${storefrontUrl}/verify`,
                    passwordResetUrl: `${storefrontUrl}/password-reset`,
                    changeEmailAddressUrl: `${storefrontUrl}/verify-email-address-change`,
                };
            })(),
        }),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: IS_DEV
                ? path.join(__dirname, '../dist/dashboard')
                : path.join(__dirname, 'dashboard'),
        }),
        LedgerPlugin,
        PosAuthPlugin,
        PharmaPlugin,
    ],
};
