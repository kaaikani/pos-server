import { gql } from 'graphql-tag';

const ledgerApiExtensions = gql`
    enum LedgerType { 
        CUSTOMER 
        SUPPLIER 
    }

    enum LedgerStatus {
        PENDING
        PARTIALLY_PAID
        FULLY_PAID
    }

    enum PaymentMode { 
        CASH 
        BANK 
        UPI 
        CREDIT 
    }

    type LedgerPayment implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        amount: Int!
        paymentDate: DateTime!
        paymentMode: PaymentMode!
    }

    type Ledger implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        type: LedgerType!
        partyName: String!
        invoiceNumber: String!
        invoiceDate: DateTime!
        amount: Int!
        paidAmount: Int!
        balance: Int!
        status: LedgerStatus!
        creditDays: Int!
        contactNumber: String!
        gstNumber: String!
        address: String!
        payments: [LedgerPayment!]!
    }

    type LedgerSummary {
        totalSales: Int!
        totalPurchase: Int!
        totalReceivable: Int!
        totalPayable: Int!
    }

    input PaymentInput {
        amount: Int!
        paymentMode: PaymentMode!
        paymentDate: DateTime!
    }

    extend type Query {
        ledgers(type: LedgerType!): [Ledger!]!
        ledger(id: ID!): Ledger
        ledgerSummary: LedgerSummary!
    }

    input CreateLedgerInput {
        type: LedgerType!
        partyName: String!
        invoiceNumber: String!
        invoiceDate: DateTime!
        amount: Int!
        creditDays: Int!
        contactNumber: String
        gstNumber: String
        address: String
    }

    extend type Mutation {
        createLedger(input: CreateLedgerInput!): Ledger!
        deleteLedger(id: ID!): Boolean!
        addPayment(ledgerId: ID!, input: PaymentInput!): Ledger!
    }
`;

export { ledgerApiExtensions };
