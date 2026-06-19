import { gql } from 'graphql-tag';

export const pharmaApiExtensions = gql`
    enum PriceTierType { SALE WHOLESALE }
    enum DiscountType { Percentage Flat }
    enum RecordStatus { ACTIVE CANCELLED }
    enum StockAdjustmentType { ADD REDUCE }
    enum PurchaseOrderStatus { OPEN CONVERTED CANCELLED }

    type PharmaSize { size: String! rate: Float! }

    type PharmaItem implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        code: String!
        itemName: String!
        tamilName: String!
        category: String!
        groupName: String!
        brand: String!
        hsnCode: String!
        barcode: String!
        upcCode: String!
        unit: String!
        packingUnit: String!
        size: String!
        taxName: String!
        mfr: String!
        purchaseRate: Float!
        purchaseTaxMode: String!
        salesRate: Float!
        salesTaxMode: String!
        salesDiscountPct: Float!
        salesDiscountFlat: Float!
        salesDiscountType: String!
        mrpRate: Float!
        baseUnitId: Int
        secondaryUnitId: Int
        conversionRate: Float!
        costRate: Float!
        cRate: Float!
        rateA: Float!
        rateB: Float!
        rateC: Float!
        rateD: Float!
        lastPurchaseRate: Float!
        lastSaleRate: Float!
        gstPercent: Float!
        discount: Float!
        profitMargin: Float!
        incentivePct: Float!
        batchNo: String!
        mfgDate: String!
        expiryDate: String!
        serialNo: String!
        minStock: Float!
        maxStock: Float!
        minStkQty: Float!
        maxStkQty: Float!
        isWeightBased: Boolean!
        isExpiryEnabled: Boolean!
        allowExpiry: Boolean!
        isStockBased: Boolean!
        sizesJson: String!
        # M2 fields
        itemType: String!
        openingQty: Float!
        openingValue: Float!
        openingStockDate: String!
        reorderLevel: Float!
        imageUrl: String!
        imageAssetId: Int
        vendureProductId: Int
        vendureVariantId: Int
        taxMasterId: Int
        priceIncludesTax: Boolean!
        stockValue: Float!
        isBatchTracked: Boolean!
        isSerialTracked: Boolean!
        currentStock: Float!
        createdByAdminId: Int
        updatedByAdminId: Int
        status: String!
        cancelledAt: DateTime
        cancelledByAdminId: Int
        cancelReason: String!
    }

    input PharmaSizeInput { size: String! rate: Float! }
    input PharmaItemInput {
        code: String
        # Required on create (validated server-side); optional on update so partial
        # patches don't have to repeat the existing name.
        itemName: String
        tamilName: String
        category: String
        groupName: String
        brand: String
        hsnCode: String
        barcode: String
        upcCode: String
        unit: String
        packingUnit: String
        size: String
        taxName: String
        mfr: String
        purchaseRate: Float
        purchaseTaxMode: String
        salesRate: Float
        salesTaxMode: String
        salesDiscountPct: Float
        salesDiscountFlat: Float
        salesDiscountType: String
        mrpRate: Float
        baseUnitId: Int
        secondaryUnitId: Int
        conversionRate: Float
        costRate: Float
        cRate: Float
        rateA: Float
        rateB: Float
        rateC: Float
        rateD: Float
        gstPercent: Float
        discount: Float
        profitMargin: Float
        incentivePct: Float
        batchNo: String
        mfgDate: String
        expiryDate: String
        serialNo: String
        minStock: Float
        maxStock: Float
        minStkQty: Float
        maxStkQty: Float
        isWeightBased: Boolean
        isExpiryEnabled: Boolean
        allowExpiry: Boolean
        isStockBased: Boolean
        sizes: [PharmaSizeInput!]
        # Convenience tier rates — server upserts PosItemPriceTier rows.
        wholesaleRate: Float
        wholesaleMinQty: Float
        retailRate: Float
        # M2 fields
        itemType: String
        openingQty: Float
        openingValue: Float
        openingStockDate: String
        reorderLevel: Float
        imageUrl: String
        taxMasterId: Int
        priceIncludesTax: Boolean
        # Upgrade A — N allowed transaction units (server upserts PosItemUnit).
        allowedUnits: [PharmaItemUnitInline!]
    }

    type PharmaPurchase implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        purNo: String!
        purDate: String!
        invNo: String!
        invDate: String!
        taxMode: String!
        payType: String!
        otherState: Boolean!
        supplier: String!
        supplierPhone: String!
        supplierGstin: String!
        stateOfSupply: String!
        placeOfSupply: String!
        itcEligible: Boolean!
        reverseCharge: Boolean!
        orderRef: String!
        transMode: String!
        address: String!
        transportName: String!
        rowsJson: String!
        totalAmount: Float!
        totalDiscA: Float!
        totalTax: Float!
        roundOff: Float!
        netAmount: Float!
        remarks: String
        createdByAdminId: Int
        updatedByAdminId: Int
        status: String!
        cancelledAt: DateTime
        cancelledByAdminId: Int
        cancelReason: String!
    }
    input PharmaPurchaseInput {
        purNo: String!
        purDate: String!
        invNo: String
        invDate: String
        taxMode: String
        payType: String
        otherState: Boolean
        supplier: String
        supplierPhone: String
        supplierGstin: String
        stateOfSupply: String
        placeOfSupply: String
        itcEligible: Boolean
        reverseCharge: Boolean
        orderRef: String
        transMode: String
        address: String
        transportName: String
        rows: [JSON!]!
        totalAmount: Float
        totalDiscA: Float
        totalTax: Float
        roundOff: Float
        netAmount: Float
        remarks: String
    }

    type PharmaPayment implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        payNo: String!
        payDate: String!
        refNo: String!
        payType: String!
        otherState: Boolean!
        supplierName: String!
        supplierGST: String!
        orderRef: String!
        transMode: String!
        address: String!
        chequeNo: String!
        bankName: String!
        narration: String!
        rowsJson: String!
        totalPaying: Float!
        totalDisc: Float!
        totalNet: Float!
    }
    input PharmaPaymentInput {
        payNo: String!
        payDate: String!
        refNo: String
        payType: String
        otherState: Boolean
        supplierName: String!
        supplierGST: String
        orderRef: String
        transMode: String
        address: String
        chequeNo: String
        bankName: String
        narration: String
        rows: [JSON!]
        totalPaying: Float
        totalDisc: Float
        totalNet: Float
    }

    type PharmaReceipt implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        docNo: String!
        docDate: String!
        billRefNo: String!
        docType: String!
        refType: String!
        accHead: String!
        payMode: String!
        narration1: String!
        narration2: String!
        cashDisc: Float!
        amount: Float!
        recAmount: Float!
        rowsJson: String!
    }
    input PharmaReceiptInput {
        docNo: String!
        docDate: String!
        billRefNo: String
        docType: String
        refType: String
        accHead: String!
        payMode: String
        narration1: String
        narration2: String
        cashDisc: Float
        amount: Float
        recAmount: Float
        rows: [JSON!]
    }

    type PharmaToken implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        tokenNo: Int!
        tokenDate: String!
        tokenTime: String!
        patientName: String!
        address: String!
        cellNo: String!
        amount: Float!
        injAmt: Float!
        total: Float!
    }
    input PharmaTokenInput {
        tokenNo: Int!
        tokenDate: String!
        tokenTime: String
        patientName: String!
        address: String
        cellNo: String
        amount: Float
        injAmt: Float
        total: Float
    }

    type PharmaSale implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        billNo: String!
        billDate: String!
        billTime: String!
        saleType: String!
        bookNo: String!
        billRef: String!
        customerName: String!
        customerPhone: String!
        customerAddress: String!
        salesMan: String!
        customerGstin: String!
        placeOfSupply: String!
        invoiceType: String!
        reverseCharge: Boolean!
        itemsJson: String!
        subtotal: Float!
        taxAmount: Float!
        discount: Float!
        transportCharges: Float!
        roundOff: Float!
        grandTotal: Float!
        cashAmount: Float!
        upiAmount: Float!
        cardAmount: Float!
        chequeAmount: Float!
        onlineAmount: Float!
        receivedAmount: Float!
        balanceDue: Float!
        changeReturned: Float!
        remarks: String!
        createdByAdminId: Int
        updatedByAdminId: Int
        status: String!
        cancelledAt: DateTime
        cancelledByAdminId: Int
        cancelReason: String!
    }
    input PharmaSaleInput {
        billNo: String!
        billDate: String!
        billTime: String
        saleType: String
        bookNo: String
        billRef: String
        customerName: String
        customerPhone: String
        customerAddress: String
        salesMan: String
        otherState: Boolean
        customerGstin: String
        placeOfSupply: String
        reverseCharge: Boolean
        roundOff: Float
        items: [JSON!]
        subtotal: Float
        taxAmount: Float
        discount: Float
        transportCharges: Float
        grandTotal: Float
        cashAmount: Float
        upiAmount: Float
        cardAmount: Float
        chequeAmount: Float
        onlineAmount: Float
        receivedAmount: Float
        balanceDue: Float
        changeReturned: Float
        remarks: String
    }

    type PharmaStockRow {
        id: ID!
        code: String!
        itemName: String!
        tamilName: String!
        category: String!
        groupName: String!
        unit: String!
        salesRate: Float!
        mrpRate: Float!
        currentStock: Float!
        minStock: Float!
        maxStock: Float!
        isStockBased: Boolean!
        isLowStock: Boolean!
    }

    type PharmaStockReport {
        itemCount: Int!
        lowStockCount: Int!
        stockTrackedCount: Int!
        totalStockUnits: Float!
        rows: [PharmaStockRow!]!
    }

    type PharmaSalesReportBill {
        id: ID!
        billNo: String!
        billDate: String!
        billTime: String!
        saleType: String!
        customerName: String!
        customerPhone: String!
        salesMan: String!
        grandTotal: Float!
        cashAmount: Float!
        upiAmount: Float!
        cardAmount: Float!
        chequeAmount: Float!
        onlineAmount: Float!
        receivedAmount: Float!
        balanceDue: Float!
    }

    type PharmaSalesReport {
        fromDate: String!
        toDate: String!
        billCount: Int!
        totalAmount: Float!
        cashTotal: Float!
        upiTotal: Float!
        cardTotal: Float!
        chequeTotal: Float!
        onlineTotal: Float!
        creditTotal: Float!
        balanceDueTotal: Float!
        discountTotal: Float!
        taxTotal: Float!
        bills: [PharmaSalesReportBill!]!
    }

    # ───── NEW: POS UNIT ─────
    type PosUnit implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        code: String!
        name: String!
        symbol: String!
        status: RecordStatus!
    }
    input PosUnitInput {
        code: String!
        name: String!
        symbol: String
    }

    # ───── NEW: POS ITEM PRICE TIER ─────
    type PosItemPriceTier implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        itemId: Int!
        tierType: PriceTierType!
        label: String!
        rate: Float!
        minQty: Float!
        taxMode: String!
        discountPct: Float!
        discountFlat: Float!
        discountType: DiscountType!
        status: RecordStatus!
    }
    input PosItemPriceTierInput {
        itemId: Int!
        tierType: PriceTierType!
        label: String
        rate: Float!
        minQty: Float
        taxMode: String
        discountPct: Float
        discountFlat: Float
        discountType: DiscountType
    }

    # ───── NEW: POS STOCK ADJUSTMENT ─────
    type PosStockAdjustment implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        adjNo: String!
        adjDate: String!
        itemCode: String!
        previousQty: Float!
        adjustQty: Float!
        resultingQty: Float!
        adjType: StockAdjustmentType!
        atPrice: Float!
        reason: String!
        details: String!
        status: RecordStatus!
        createdByAdminId: Int
    }
    input PosStockAdjustmentInput {
        adjNo: String!
        adjDate: String!
        itemCode: String!
        adjustQty: Float!
        adjType: StockAdjustmentType!
        atPrice: Float
        reason: String
        details: String
    }

    # ───── NEW: POS PURCHASE RETURN ─────
    type PosPurchaseReturn implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        retNo: String!
        retDate: String!
        originalPurchaseId: Int
        supplier: String!
        supplierGstin: String!
        placeOfSupply: String!
        address: String!
        rowsJson: String!
        totalAmount: Float!
        totalDisc: Float!
        totalTax: Float!
        netAmount: Float!
        reason: String!
        status: RecordStatus!
        createdByAdminId: Int
    }
    input PosPurchaseReturnInput {
        retNo: String!
        retDate: String!
        originalPurchaseId: Int
        supplier: String
        address: String
        rows: [JSON!]
        totalAmount: Float
        totalDisc: Float
        totalTax: Float
        netAmount: Float
        reason: String
    }

    # ───── NEW: POS PURCHASE ORDER ─────
    type PosPurchaseOrder implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        poNo: String!
        poDate: String!
        expectedDate: String!
        supplier: String!
        address: String!
        rowsJson: String!
        status: PurchaseOrderStatus!
        convertedPurchaseId: Int
        totalAmount: Float!
        netAmount: Float!
        remarks: String!
        createdByAdminId: Int
    }
    input PosPurchaseOrderInput {
        poNo: String!
        poDate: String!
        expectedDate: String
        supplier: String
        address: String
        rows: [JSON!]
        totalAmount: Float
        netAmount: Float
        remarks: String
    }

    # ───── NEW: POS EXPENSE CATEGORY ─────
    type PosExpenseCategory implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        status: RecordStatus!
    }
    input PosExpenseCategoryInput {
        name: String!
    }

    # ───── NEW: POS EXPENSE ITEM ─────
    type PosExpenseItem implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        itemName: String!
        hsnCode: String!
        description: String!
        price: Float!
        taxMode: String!
        taxPercent: Float!
        status: RecordStatus!
    }
    input PosExpenseItemInput {
        itemName: String!
        hsnCode: String
        description: String
        price: Float
        taxMode: String
        taxPercent: Float
    }

    # ───── NEW: POS EXPENSE ─────
    type PosExpense implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        expenseNo: String!
        expenseDate: String!
        categoryId: Int
        categoryName: String!
        gstApplied: Boolean!
        payType: String!
        vendorName: String!
        vendorGstin: String!
        billNumber: String!
        billDate: String!
        placeOfSupply: String!
        itcClaimable: Boolean!
        rowsJson: String!
        roundOff: Float!
        totalAmount: Float!
        netAmount: Float!
        "Total GST (CGST+SGST+IGST) on the voucher: netAmount − roundOff − totalAmount."
        taxAmount: Float!
        description: String!
        remarks: String!
        status: RecordStatus!
        createdByAdminId: Int
    }
    input PosExpenseInput {
        expenseNo: String!
        expenseDate: String!
        categoryId: Int
        gstApplied: Boolean
        otherState: Boolean
        vendorName: String
        vendorGstin: String
        billNumber: String
        billDate: String
        placeOfSupply: String
        itcClaimable: Boolean
        payType: String
        rows: [JSON!]
        roundOff: Float
        totalAmount: Float
        netAmount: Float
        description: String
        remarks: String
    }

    # ───── Day Book (cash/bank movement) ─────
    type DayBookEntry {
        date: String!
        type: String!
        refNo: String!
        particulars: String!
        mode: String!
        inAmount: Float!
        outAmount: Float!
    }
    type DayBookReport {
        fromDate: String!
        toDate: String!
        openingBalance: Float!
        totalIn: Float!
        totalOut: Float!
        netFlow: Float!
        closingBalance: Float!
        entries: [DayBookEntry!]!
    }

    # ───── GST report (output vs input tax) ─────
    type GstSlabRow {
        gstPercent: Float!
        taxableAmount: Float!
        cgst: Float!
        sgst: Float!
        igst: Float!
        cess: Float!
        totalTax: Float!
    }
    type GstReportSection {
        taxableTotal: Float!
        cgstTotal: Float!
        sgstTotal: Float!
        igstTotal: Float!
        cessTotal: Float!
        taxTotal: Float!
        slabs: [GstSlabRow!]!
    }
    type GstReportCompany {
        companyName: String!
        gstin: String!
        stateName: String!
        stateCode: String!
    }
    type GstReport {
        fromDate: String!
        toDate: String!
        company: GstReportCompany
        output: GstReportSection!
        input: GstReportSection!
        netGstPayable: Float!
    }

    # ───── Purchase report ─────
    type PurchaseSupplierRow {
        supplier: String!
        billCount: Int!
        taxable: Float!
        tax: Float!
        discount: Float!
        net: Float!
    }
    type PurchaseReport {
        fromDate: String!
        toDate: String!
        billCount: Int!
        totalTaxable: Float!
        totalTax: Float!
        totalDiscount: Float!
        totalNet: Float!
        bySupplier: [PurchaseSupplierRow!]!
    }

    # ───── Expense report (by category) ─────
    type ExpenseCategoryRow {
        categoryId: Int
        categoryName: String!
        count: Int!
        taxable: Float!
        tax: Float!
        net: Float!
    }
    type ExpenseReport {
        fromDate: String!
        toDate: String!
        expenseCount: Int!
        totalTaxable: Float!
        totalTax: Float!
        totalNet: Float!
        byCategory: [ExpenseCategoryRow!]!
    }

    # ───── GSTR-1 / GSTR-3B (filing returns) ─────
    type GstRateBucket {
        rate: Float!
        taxableValue: Float!
        igst: Float!
        cgst: Float!
        sgst: Float!
        cess: Float!
    }
    type Gstr1Invoice {
        docNo: String!
        docDate: String!
        customerGstin: String!
        customerName: String!
        placeOfSupply: String!
        reverseCharge: Boolean!
        invoiceValue: Float!
        interState: Boolean!
        items: [GstRateBucket!]!
    }
    type Gstr1B2csRow {
        placeOfSupply: String!
        supplyType: String!
        rate: Float!
        taxableValue: Float!
        igst: Float!
        cgst: Float!
        sgst: Float!
        cess: Float!
    }
    type Gstr1HsnRow {
        hsnCode: String!
        description: String!
        uqc: String!
        totalQty: Float!
        rate: Float!
        taxableValue: Float!
        igst: Float!
        cgst: Float!
        sgst: Float!
        cess: Float!
        totalValue: Float!
    }
    type Gstr1DocRange {
        natureOfDocument: String!
        fromSerial: String!
        toSerial: String!
        totalCount: Int!
        cancelledCount: Int!
        netIssued: Int!
    }
    type GstReturnTotals {
        invoiceCount: Int!
        taxableValue: Float!
        igst: Float!
        cgst: Float!
        sgst: Float!
        cess: Float!
        totalTax: Float!
    }
    type Gstr1Report {
        fromDate: String!
        toDate: String!
        filingPeriod: String!
        company: GstReportCompany
        b2b: [Gstr1Invoice!]!
        b2cl: [Gstr1Invoice!]!
        b2cs: [Gstr1B2csRow!]!
        cdnr: [Gstr1Invoice!]!
        hsn: [Gstr1HsnRow!]!
        docs: [Gstr1DocRange!]!
        totals: GstReturnTotals!
        warnings: [String!]!
    }
    type Gstr3bSupplyRow {
        label: String!
        taxableValue: Float!
        igst: Float!
        cgst: Float!
        sgst: Float!
        cess: Float!
    }
    type Gstr3bReport {
        fromDate: String!
        toDate: String!
        filingPeriod: String!
        company: GstReportCompany
        outward: [Gstr3bSupplyRow!]!
        itc: [Gstr3bSupplyRow!]!
        netTaxPayable: Gstr3bSupplyRow!
        warnings: [String!]!
    }
    type GstCsvFile {
        section: String!
        filename: String!
        content: String!
    }

    # ───── Cleanup — reconcileSalesReturnsToLedger ─────
    type ReconcileLedgerCorrection {
        ledgerId: ID!
        returnId: ID!
        retNo: String!
        beforeAmount: Int!
        beforeBalance: Int!
        afterAmount: Int!
        afterBalance: Int!
        deltaApplied: Int!
    }
    type ReconcileLedgerReport {
        totalReturns: Int!
        updated: Int!
        skipped: Int!
        corrections: [ReconcileLedgerCorrection!]!
    }

    # ───── M4 — Sales Return ─────
    type PosSalesReturn implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        retNo: String!
        retDate: String!
        retTime: String!
        originalSaleId: Int
        originalBillNo: String!
        customerName: String!
        customerPhone: String!
        customerAddress: String!
        customerGstin: String!
        placeOfSupply: String!
        rowsJson: String
        totalAmount: Float!
        totalTax: Float!
        totalDisc: Float!
        netAmount: Float!
        reason: String!
        remarks: String!
        status: String!
        createdByAdminId: Int
        cancelledAt: DateTime
        cancelledByAdminId: Int
        cancelReason: String!
    }
    input PosSalesReturnRowInput {
        itemCode: String!
        itemName: String
        returnQty: Float!
        taxAmount: Float
    }
    input PosSalesReturnInput {
        retNo: String!
        retDate: String!
        retTime: String
        originalSaleId: Int!
        reason: String
        remarks: String
        rows: [PosSalesReturnRowInput!]!
    }
    type PharmaSaleForReturnItem {
        itemCode: String!
        itemName: String!
        hsnCode: String!
        originalQty: Float!
        alreadyReturned: Float!
        remainingQty: Float!
        originalSalesRate: Float!
        mrpRate: Float!
        taxPct: Float!
        gstPercent: Float!
        priceInclusive: Boolean!
        unit: String!
    }
    type PharmaSaleForReturn {
        id: ID!
        billNo: String!
        billDate: String!
        customerName: String!
        customerPhone: String!
        grandTotal: Float!
        balanceDue: Float!
        items: [PharmaSaleForReturnItem!]!
    }

    # ───── Upgrade A — PosItemUnit (N transaction units per item) ─────
    type PosItemUnit implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        itemId: Int!
        unitId: Int!
        conversionRate: Float!
        isBase: Boolean!
        status: String!
    }
    input PosItemUnitInput {
        itemId: Int!
        unitCode: String!
        conversionRate: Float!
        isBase: Boolean
    }
    "Inline form used inside PharmaItemInput.allowedUnits — server resolves unitCode→unitId and upserts the full set in one call."
    input PharmaItemUnitInline {
        unitCode: String!
        conversionRate: Float!
        isBase: Boolean
    }
    "Per-item allowed-units payload returned by pharmaItemForTransaction so Sales/Purchase forms can render a unit dropdown."
    type PharmaItemForTransactionAllowedUnit {
        unitCode: String!
        conversionRate: Float!
        isBase: Boolean!
    }

    # ───── Fix 1 — PosSetting (singleton) ─────
    type PosSetting implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        allowNegativeStock: Boolean!
        allowReturnRateOverride: Boolean!
        updatedByAdminId: Int
    }
    input PosSettingInput {
        allowNegativeStock: Boolean
        allowReturnRateOverride: Boolean
    }

    # ───── M2 — TaxMaster / ItemBarcode / Auto-fill ─────
    type PosTaxMaster implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        code: String!
        name: String!
        ratePercent: Float!
        taxType: String!
        isDefault: Boolean!
        status: String!
    }
    input PosTaxMasterInput {
        code: String!
        name: String!
        ratePercent: Float!
        taxType: String!
        isDefault: Boolean
    }
    input PosTaxMasterUpdateInput {
        code: String
        name: String
        ratePercent: Float
        taxType: String
        isDefault: Boolean
    }
    type PosItemBarcode implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        itemId: Int!
        barcode: String!
        isPrimary: Boolean!
        status: String!
    }
    input PosItemBarcodeInput {
        itemId: Int!
        barcode: String!
        isPrimary: Boolean
    }
    type PharmaItemForTransactionTier {
        tierType: String!
        rate: Float!
        minQty: Float!
    }
    type PharmaItemForTransaction {
        id: ID!
        code: String!
        itemName: String!
        hsnCode: String!
        unit: String!
        baseUnit: String!
        secondaryUnit: String!
        conversionRate: Float!
        mrpRate: Float!
        purchaseRate: Float!
        salesRate: Float!
        lastSaleRate: Float!
        lastPurchaseRate: Float!
        currentStock: Float!
        isStockBased: Boolean!
        taxName: String!
        gstPercent: Float!
        taxMasterId: Int
        purchaseTaxMode: String!
        salesTaxMode: String!
        priceIncludesTax: Boolean!
        tiers: [PharmaItemForTransactionTier!]!
        allowedUnits: [PharmaItemForTransactionAllowedUnit!]!
    }

    # ───── M1 — Stock Ledger / Snapshot / Reconciliation ─────
    type PosStockLedger implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        itemId: Int!
        itemCode: String!
        refType: String!
        refId: Int!
        refNo: String!
        movementDate: String!
        qty: Float!
        unit: String!
        previousBalance: Float!
        runningBalance: Float!
        warehouseId: Int
        reason: String!
        createdByAdminId: Int
    }
    type PosItemStockSnapshot implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        itemId: Int!
        warehouseId: Int
        currentStock: Float!
        reservedQty: Float!
    }
    type PosStockReconciliationRow {
        itemId: Int!
        itemCode: String!
        ledgerSum: Float!
        snapshotStock: Float!
        diff: Float!
        ok: Boolean!
    }
    type PosStockReconciliation {
        totalItems: Int!
        mismatched: Int!
        rows: [PosStockReconciliationRow!]!
    }
    type PosStockLedgerCounts {
        total: Int!
        opening: Int!
        purchase: Int!
        sale: Int!
        saleReturn: Int!
        purchaseReturn: Int!
        cancels: Int!
    }
    type PosStockIntegritySettings {
        allowNegativeStock: Boolean!
        allowReturnRateOverride: Boolean!
    }
    type PosStockIntegrityReport {
        invariantHolds: Boolean!
        totalItems: Int!
        mismatched: Int!
        mismatchedRows: [PosStockReconciliationRow!]!
        ledgerCounts: PosStockLedgerCounts!
        settings: PosStockIntegritySettings!
    }

    # ───── PosCompany (seller GST identity) ─────
    type PosCompany implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        companyName: String!
        legalName: String!
        gstin: String!
        phone: String!
        email: String!
        address: String!
        pincode: String!
        stateName: String!
        stateCode: String!
        financialYear: String!
        isActive: Boolean!
        channelId: Int
        status: RecordStatus!
    }
    input PosCompanyInput {
        companyName: String!
        legalName: String
        gstin: String
        phone: String
        email: String
        address: String
        pincode: String
        stateName: String
        stateCode: String
        financialYear: String
        isActive: Boolean
    }

    extend type Query {
        pharmaItems: [PharmaItem!]!
        pharmaItem(id: ID!): PharmaItem
        pharmaPurchases(fromDate: String, toDate: String): [PharmaPurchase!]!
        pharmaPayments(fromDate: String, toDate: String): [PharmaPayment!]!
        pharmaReceipts(fromDate: String, toDate: String): [PharmaReceipt!]!
        pharmaTokens(tokenDate: String): [PharmaToken!]!
        pharmaSales(fromDate: String, toDate: String): [PharmaSale!]!
        pharmaSale(id: ID!): PharmaSale
        pharmaSaleByBillNo(billNo: String!): PharmaSale
        pharmaSalesReport(fromDate: String, toDate: String): PharmaSalesReport!
        pharmaCurrentStock(onlyLowStock: Boolean, onlyStockBased: Boolean): PharmaStockReport!

        posUnits: [PosUnit!]!
        posItemPriceTiers(itemId: ID!): [PosItemPriceTier!]!
        posStockAdjustments: [PosStockAdjustment!]!
        posPurchaseReturns: [PosPurchaseReturn!]!
        posPurchaseOrders(status: PurchaseOrderStatus): [PosPurchaseOrder!]!
        posPurchaseOrder(id: ID!): PosPurchaseOrder
        posExpenseCategories: [PosExpenseCategory!]!
        posExpenseItems: [PosExpenseItem!]!
        posExpenses(fromDate: String, toDate: String): [PosExpense!]!
        posExpense(id: ID!): PosExpense

        # Seller company / GST identity
        posCompanies: [PosCompany!]!
        posActiveCompany: PosCompany

        # Day Book — cash/bank movements for a date range (toDate defaults to fromDate)
        dayBook(fromDate: String!, toDate: String): DayBookReport!

        # GST report — output tax (sales) vs input tax (purchases + expenses)
        gstReport(fromDate: String!, toDate: String): GstReport!

        # GSTR-1 — structured B2B/B2CL/B2CS/CDNR/HSN/DOCS for a date range
        gstr1Report(fromDate: String!, toDate: String): Gstr1Report!
        # GSTR-1 — official GSTN portal JSON envelope (uploadable), serialised
        gstr1PortalJson(fromDate: String!, toDate: String): String!
        # GSTR-1 — review CSVs, one per section
        gstr1Csvs(fromDate: String!, toDate: String): [GstCsvFile!]!
        # GSTR-3B — 3.1 outward / 4 ITC / net payable summary
        gstr3bReport(fromDate: String!, toDate: String): Gstr3bReport!
        # GSTR-3B — review CSV (single file)
        gstr3bCsv(fromDate: String!, toDate: String): GstCsvFile!

        # Purchase report — totals + per-supplier rollup
        purchaseReport(fromDate: String!, toDate: String): PurchaseReport!

        # Expense report — totals + per-category rollup
        expenseReport(fromDate: String!, toDate: String): ExpenseReport!

        # M1 — stock ledger + snapshot + reconciliation
        posStockLedger(itemCode: String, refType: String, limit: Int): [PosStockLedger!]!
        posItemStockSnapshots: [PosItemStockSnapshot!]!
        posStockReconciliation: PosStockReconciliation!
        posStockIntegrityReport: PosStockIntegrityReport!

        # M2 — TaxMaster + Barcode + Auto-fill
        posTaxMasters: [PosTaxMaster!]!
        posItemBarcodes(itemId: ID!): [PosItemBarcode!]!
        pharmaItemForTransaction(code: String, barcode: String): PharmaItemForTransaction

        # M4 — Sales Return + Purchase Return upgrades
        pharmaSalesByCustomer(customerPhone: String, customerName: String, limit: Int): [PharmaSale!]!
        getSaleForReturn(saleId: ID!): PharmaSaleForReturn
        posSalesReturns(originalSaleId: Int, customerPhone: String, includeCancelled: Boolean): [PosSalesReturn!]!
        searchPurchasesForReturn(supplier: String, itemCode: String, fromDate: String, toDate: String, limit: Int): [PharmaPurchase!]!

        # Fix 1 — PosSetting singleton
        posSetting: PosSetting!

        # Upgrade A — PosItemUnit
        posItemUnits(itemId: ID!): [PosItemUnit!]!
    }

    extend type Mutation {
        createPharmaItem(input: PharmaItemInput!): PharmaItem!
        updatePharmaItem(id: ID!, input: PharmaItemInput!): PharmaItem!
        deletePharmaItem(id: ID!): Boolean!
        cancelPharmaItem(id: ID!, reason: String): PharmaItem!

        createPharmaPurchase(input: PharmaPurchaseInput!): PharmaPurchase!
        deletePharmaPurchase(id: ID!): Boolean!
        cancelPharmaPurchase(id: ID!, reason: String): PharmaPurchase!

        createPharmaPayment(input: PharmaPaymentInput!): PharmaPayment!
        deletePharmaPayment(id: ID!): Boolean!

        createPharmaReceipt(input: PharmaReceiptInput!): PharmaReceipt!
        deletePharmaReceipt(id: ID!): Boolean!

        createPharmaToken(input: PharmaTokenInput!): PharmaToken!
        deletePharmaToken(id: ID!): Boolean!

        createPharmaSale(input: PharmaSaleInput!): PharmaSale!
        deletePharmaSale(id: ID!): Boolean!
        cancelPharmaSale(id: ID!, reason: String): PharmaSale!

        # M2 — TaxMaster + Barcode CRUD
        createPosTaxMaster(input: PosTaxMasterInput!): PosTaxMaster!
        updatePosTaxMaster(id: ID!, input: PosTaxMasterUpdateInput!): PosTaxMaster!
        deletePosTaxMaster(id: ID!): PosTaxMaster!
        addPosItemBarcode(input: PosItemBarcodeInput!): PosItemBarcode!
        removePosItemBarcode(id: ID!): Boolean!
        # Server-generated, server-validated, deduped EAN-13 (in-store prefix).
        generatePosItemBarcode(itemId: ID!): PosItemBarcode!
        generateMissingPosItemBarcodes: [PosItemBarcode!]!

        # M4 — Sales Return
        createPosSalesReturn(input: PosSalesReturnInput!): PosSalesReturn!
        cancelPosSalesReturn(id: ID!, reason: String): PosSalesReturn!

        # M5 — Vendure forward sync admin bootstrap
        syncAllItemsToVendure: Int!

        # Cleanup — retroactively apply ledger reductions for bug-period sales returns
        reconcileSalesReturnsToLedger: ReconcileLedgerReport!

        # Fix 1 — PosSetting update
        updatePosSetting(input: PosSettingInput!): PosSetting!

        # Upgrade A — PosItemUnit CRUD
        addPosItemUnit(input: PosItemUnitInput!): PosItemUnit!
        removePosItemUnit(id: ID!): Boolean!

        createPosUnit(input: PosUnitInput!): PosUnit!
        updatePosUnit(id: ID!, input: PosUnitInput!): PosUnit!
        cancelPosUnit(id: ID!): PosUnit!

        createPosItemPriceTier(input: PosItemPriceTierInput!): PosItemPriceTier!
        updatePosItemPriceTier(id: ID!, input: PosItemPriceTierInput!): PosItemPriceTier!
        cancelPosItemPriceTier(id: ID!): PosItemPriceTier!

        createPosStockAdjustment(input: PosStockAdjustmentInput!): PosStockAdjustment!
        cancelPosStockAdjustment(id: ID!): PosStockAdjustment!

        createPosPurchaseReturn(input: PosPurchaseReturnInput!): PosPurchaseReturn!
        cancelPosPurchaseReturn(id: ID!): PosPurchaseReturn!

        createPosPurchaseOrder(input: PosPurchaseOrderInput!): PosPurchaseOrder!
        updatePosPurchaseOrder(id: ID!, input: PosPurchaseOrderInput!): PosPurchaseOrder!
        cancelPosPurchaseOrder(id: ID!): PosPurchaseOrder!
        convertPosPurchaseOrderToPurchase(id: ID!): PharmaPurchase!

        createPosExpenseCategory(input: PosExpenseCategoryInput!): PosExpenseCategory!
        updatePosExpenseCategory(id: ID!, input: PosExpenseCategoryInput!): PosExpenseCategory!
        cancelPosExpenseCategory(id: ID!): PosExpenseCategory!

        createPosExpenseItem(input: PosExpenseItemInput!): PosExpenseItem!
        updatePosExpenseItem(id: ID!, input: PosExpenseItemInput!): PosExpenseItem!
        cancelPosExpenseItem(id: ID!): PosExpenseItem!

        createPosExpense(input: PosExpenseInput!): PosExpense!
        cancelPosExpense(id: ID!): PosExpense!

        # Seller company / GST identity
        createPosCompany(input: PosCompanyInput!): PosCompany!
        updatePosCompany(id: ID!, input: PosCompanyInput!): PosCompany!
        setActivePosCompany(id: ID!): PosCompany!
        deletePosCompany(id: ID!): PosCompany!
    }
`;
