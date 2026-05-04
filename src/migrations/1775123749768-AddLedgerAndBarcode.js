

export class AddLedgerAndBarcode1775123749768  {

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "ledger_payment" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "amount" integer NOT NULL, "paymentDate" datetime NOT NULL, "paymentMode" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "ledgerId" integer)`, undefined);
        await queryRunner.query(`CREATE TABLE "ledger" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "type" varchar NOT NULL, "partyName" varchar NOT NULL, "invoiceNumber" varchar NOT NULL, "invoiceDate" datetime NOT NULL, "amount" integer NOT NULL, "paidAmount" integer NOT NULL, "balance" integer NOT NULL, "status" varchar NOT NULL, "creditDays" integer NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_6e420052844edf3a5506d863ce"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_0e6f516053cf982b537836e21c"`, undefined);
        await queryRunner.query(`CREATE TABLE "temporary_product_variant" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "enabled" boolean NOT NULL DEFAULT (1), "sku" varchar NOT NULL, "outOfStockThreshold" integer NOT NULL DEFAULT (0), "useGlobalOutOfStockThreshold" boolean NOT NULL DEFAULT (1), "trackInventory" varchar NOT NULL DEFAULT ('INHERIT'), "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "featuredAssetId" integer, "taxCategoryId" integer, "productId" integer, "customFieldsBarcode" varchar(255), CONSTRAINT "FK_6e420052844edf3a5506d863ce6" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e38dca0d82fd64c7cf8aac8b8ef" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_0e6f516053cf982b537836e21cf" FOREIGN KEY ("featuredAssetId") REFERENCES "asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "temporary_product_variant"("createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId") SELECT "createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId" FROM "product_variant"`, undefined);
        await queryRunner.query(`DROP TABLE "product_variant"`, undefined);
        await queryRunner.query(`ALTER TABLE "temporary_product_variant" RENAME TO "product_variant"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_6e420052844edf3a5506d863ce" ON "product_variant" ("productId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e" ON "product_variant" ("taxCategoryId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_0e6f516053cf982b537836e21c" ON "product_variant" ("featuredAssetId") `, undefined);
        await queryRunner.query(`CREATE TABLE "temporary_ledger_payment" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "amount" integer NOT NULL, "paymentDate" datetime NOT NULL, "paymentMode" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "ledgerId" integer, CONSTRAINT "FK_539728a4b65c1cd16c80f71509a" FOREIGN KEY ("ledgerId") REFERENCES "ledger" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "temporary_ledger_payment"("createdAt", "updatedAt", "amount", "paymentDate", "paymentMode", "id", "ledgerId") SELECT "createdAt", "updatedAt", "amount", "paymentDate", "paymentMode", "id", "ledgerId" FROM "ledger_payment"`, undefined);
        await queryRunner.query(`DROP TABLE "ledger_payment"`, undefined);
        await queryRunner.query(`ALTER TABLE "temporary_ledger_payment" RENAME TO "ledger_payment"`, undefined);
   }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ledger_payment" RENAME TO "temporary_ledger_payment"`, undefined);
        await queryRunner.query(`CREATE TABLE "ledger_payment" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "amount" integer NOT NULL, "paymentDate" datetime NOT NULL, "paymentMode" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "ledgerId" integer)`, undefined);
        await queryRunner.query(`INSERT INTO "ledger_payment"("createdAt", "updatedAt", "amount", "paymentDate", "paymentMode", "id", "ledgerId") SELECT "createdAt", "updatedAt", "amount", "paymentDate", "paymentMode", "id", "ledgerId" FROM "temporary_ledger_payment"`, undefined);
        await queryRunner.query(`DROP TABLE "temporary_ledger_payment"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_0e6f516053cf982b537836e21c"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_6e420052844edf3a5506d863ce"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" RENAME TO "temporary_product_variant"`, undefined);
        await queryRunner.query(`CREATE TABLE "product_variant" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "enabled" boolean NOT NULL DEFAULT (1), "sku" varchar NOT NULL, "outOfStockThreshold" integer NOT NULL DEFAULT (0), "useGlobalOutOfStockThreshold" boolean NOT NULL DEFAULT (1), "trackInventory" varchar NOT NULL DEFAULT ('INHERIT'), "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "featuredAssetId" integer, "taxCategoryId" integer, "productId" integer, CONSTRAINT "FK_6e420052844edf3a5506d863ce6" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e38dca0d82fd64c7cf8aac8b8ef" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_0e6f516053cf982b537836e21cf" FOREIGN KEY ("featuredAssetId") REFERENCES "asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "product_variant"("createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId") SELECT "createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId" FROM "temporary_product_variant"`, undefined);
        await queryRunner.query(`DROP TABLE "temporary_product_variant"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_0e6f516053cf982b537836e21c" ON "product_variant" ("featuredAssetId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e" ON "product_variant" ("taxCategoryId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_6e420052844edf3a5506d863ce" ON "product_variant" ("productId") `, undefined);
        await queryRunner.query(`DROP TABLE "ledger"`, undefined);
        await queryRunner.query(`DROP TABLE "ledger_payment"`, undefined);
   }

}
