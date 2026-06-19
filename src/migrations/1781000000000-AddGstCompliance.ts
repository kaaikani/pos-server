import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * GST compliance foundation (Step 1 + Step 4 + Step 5).
 *
 *  - Creates the `pos_company` table (seller GST identity).
 *  - Adds transaction-level GST compliance columns to sales, purchases,
 *    expenses, and both return tables (GSTIN, place of supply, invoice type,
 *    reverse charge, ITC flags, round-off).
 *
 * Dev uses `synchronize` so these are applied automatically there; this
 * migration is for production (`migration:run`). MySQL dialect.
 */
export class AddGstCompliance1781000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── Step 1: pos_company (seller GST identity) ──
        await queryRunner.query(`CREATE TABLE \`pos_company\` (
            \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
            \`companyName\` varchar(255) NOT NULL,
            \`legalName\` varchar(255) NOT NULL DEFAULT '',
            \`gstin\` varchar(255) NOT NULL DEFAULT '',
            \`phone\` varchar(255) NOT NULL DEFAULT '',
            \`email\` varchar(255) NOT NULL DEFAULT '',
            \`address\` varchar(255) NOT NULL DEFAULT '',
            \`pincode\` varchar(255) NOT NULL DEFAULT '',
            \`stateName\` varchar(255) NOT NULL DEFAULT '',
            \`stateCode\` varchar(255) NOT NULL DEFAULT '',
            \`financialYear\` varchar(255) NOT NULL DEFAULT '',
            \`isActive\` tinyint NOT NULL DEFAULT 0,
            \`channelId\` int NULL,
            \`status\` varchar(255) NOT NULL DEFAULT 'ACTIVE',
            \`createdByAdminId\` int NULL,
            \`updatedByAdminId\` int NULL,
            \`id\` int NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB`, undefined);

        // ── Step 4: Sales ──
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` ADD \`customerGstin\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` ADD \`placeOfSupply\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` ADD \`invoiceType\` varchar(255) NOT NULL DEFAULT 'B2C'`, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` ADD \`reverseCharge\` tinyint NOT NULL DEFAULT 0`, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` ADD \`roundOff\` float NOT NULL DEFAULT '0'`, undefined);

        // ── Step 4: Purchases ──
        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` ADD \`supplierGstin\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` ADD \`placeOfSupply\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` ADD \`itcEligible\` tinyint NOT NULL DEFAULT 1`, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` ADD \`reverseCharge\` tinyint NOT NULL DEFAULT 0`, undefined);

        // ── Step 4: Expenses ──
        await queryRunner.query(`ALTER TABLE \`pos_expense\` ADD \`vendorName\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` ADD \`vendorGstin\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` ADD \`billNumber\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` ADD \`billDate\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` ADD \`placeOfSupply\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` ADD \`itcClaimable\` tinyint NOT NULL DEFAULT 1`, undefined);

        // ── Step 4: Sales Return ──
        await queryRunner.query(`ALTER TABLE \`pos_sales_return\` ADD \`customerGstin\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_sales_return\` ADD \`placeOfSupply\` varchar(255) NOT NULL DEFAULT ''`, undefined);

        // ── Step 4: Purchase Return ──
        await queryRunner.query(`ALTER TABLE \`pos_purchase_return\` ADD \`supplierGstin\` varchar(255) NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_purchase_return\` ADD \`placeOfSupply\` varchar(255) NOT NULL DEFAULT ''`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`pos_purchase_return\` DROP COLUMN \`placeOfSupply\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_purchase_return\` DROP COLUMN \`supplierGstin\``, undefined);

        await queryRunner.query(`ALTER TABLE \`pos_sales_return\` DROP COLUMN \`placeOfSupply\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_sales_return\` DROP COLUMN \`customerGstin\``, undefined);

        await queryRunner.query(`ALTER TABLE \`pos_expense\` DROP COLUMN \`itcClaimable\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` DROP COLUMN \`placeOfSupply\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` DROP COLUMN \`billDate\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` DROP COLUMN \`billNumber\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` DROP COLUMN \`vendorGstin\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pos_expense\` DROP COLUMN \`vendorName\``, undefined);

        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` DROP COLUMN \`reverseCharge\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` DROP COLUMN \`itcEligible\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` DROP COLUMN \`placeOfSupply\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_purchase\` DROP COLUMN \`supplierGstin\``, undefined);

        await queryRunner.query(`ALTER TABLE \`pharma_sale\` DROP COLUMN \`roundOff\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` DROP COLUMN \`reverseCharge\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` DROP COLUMN \`invoiceType\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` DROP COLUMN \`placeOfSupply\``, undefined);
        await queryRunner.query(`ALTER TABLE \`pharma_sale\` DROP COLUMN \`customerGstin\``, undefined);

        await queryRunner.query(`DROP TABLE \`pos_company\``, undefined);
    }
}
