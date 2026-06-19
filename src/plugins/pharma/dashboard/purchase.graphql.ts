import { graphql } from '@/vdb/graphql/graphql.js';

export const pharmaPurchasesQuery = graphql(`
    query PharmaPurchases {
        pharmaPurchases {
            id
            purNo
            purDate
            supplier
            supplierPhone
            payType
            totalAmount
            totalDiscA
            totalTax
            netAmount
            createdAt
        }
    }
`);

export const itemsForPurchasePickerQuery = graphql(`
    query ItemsForPurchasePicker {
        pharmaItems {
            id
            code
            itemName
            barcode
            unit
            mrpRate
            purchaseRate
            salesRate
            gstPercent
            purchaseTaxMode
            isStockBased
            baseUnitId
            secondaryUnitId
            conversionRate
        }
    }
`);

export const createPharmaPurchaseMutation = graphql(`
    mutation CreatePharmaPurchase($input: PharmaPurchaseInput!) {
        createPharmaPurchase(input: $input) {
            id
            purNo
            netAmount
        }
    }
`);

export const deletePharmaPurchaseMutation = graphql(`
    mutation DeletePharmaPurchase($id: ID!) {
        deletePharmaPurchase(id: $id)
    }
`);

export const posUnitsQuery = graphql(`
    query PosUnits {
        posUnits {
            id
            code
            name
            symbol
        }
    }
`);
