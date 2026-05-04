import { gql } from 'graphql-tag';

export const pharmaApiExtensions = gql`
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
        salesRate: Float!
        mrpRate: Float!
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
        sizesJson: String!
    }

    input PharmaSizeInput { size: String! rate: Float! }
    input PharmaItemInput {
        code: String
        itemName: String!
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
        salesRate: Float
        mrpRate: Float
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
        sizes: [PharmaSizeInput!]
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
        orderRef: String!
        transMode: String!
        address: String!
        transportName: String!
        rowsJson: String!
        totalAmount: Float!
        totalDiscA: Float!
        totalTax: Float!
        netAmount: Float!
    }
    input PharmaPurchaseInput {
        purNo: String!
        purDate: String!
        invNo: String
        invDate: String
        taxMode: String
        payType: String
        otherState: Boolean
        supplier: String!
        orderRef: String
        transMode: String
        address: String
        transportName: String
        rows: [JSON!]
        totalAmount: Float
        totalDiscA: Float
        totalTax: Float
        netAmount: Float
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
        itemsJson: String!
        subtotal: Float!
        taxAmount: Float!
        discount: Float!
        transportCharges: Float!
        grandTotal: Float!
        cashAmount: Float!
        upiAmount: Float!
        cardAmount: Float!
        receivedAmount: Float!
        balanceDue: Float!
        changeReturned: Float!
        remarks: String!
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
        items: [JSON!]
        subtotal: Float
        taxAmount: Float
        discount: Float
        transportCharges: Float
        grandTotal: Float
        cashAmount: Float
        upiAmount: Float
        cardAmount: Float
        receivedAmount: Float
        balanceDue: Float
        changeReturned: Float
        remarks: String
    }

    extend type Query {
        pharmaItems: [PharmaItem!]!
        pharmaItem(id: ID!): PharmaItem
        pharmaPurchases: [PharmaPurchase!]!
        pharmaPayments: [PharmaPayment!]!
        pharmaReceipts: [PharmaReceipt!]!
        pharmaTokens(tokenDate: String): [PharmaToken!]!
        pharmaSales(fromDate: String, toDate: String): [PharmaSale!]!
        pharmaSale(id: ID!): PharmaSale
    }

    extend type Mutation {
        createPharmaItem(input: PharmaItemInput!): PharmaItem!
        updatePharmaItem(id: ID!, input: PharmaItemInput!): PharmaItem!
        deletePharmaItem(id: ID!): Boolean!

        createPharmaPurchase(input: PharmaPurchaseInput!): PharmaPurchase!
        deletePharmaPurchase(id: ID!): Boolean!

        createPharmaPayment(input: PharmaPaymentInput!): PharmaPayment!
        deletePharmaPayment(id: ID!): Boolean!

        createPharmaReceipt(input: PharmaReceiptInput!): PharmaReceipt!
        deletePharmaReceipt(id: ID!): Boolean!

        createPharmaToken(input: PharmaTokenInput!): PharmaToken!
        deletePharmaToken(id: ID!): Boolean!

        createPharmaSale(input: PharmaSaleInput!): PharmaSale!
        deletePharmaSale(id: ID!): Boolean!
    }
`;
