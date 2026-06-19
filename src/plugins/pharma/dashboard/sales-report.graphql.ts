import { graphql } from '@/vdb/graphql/graphql.js';

export const pharmaSalesReportQuery = graphql(`
    query PharmaSalesReport($fromDate: String, $toDate: String) {
        pharmaSalesReport(fromDate: $fromDate, toDate: $toDate) {
            fromDate
            toDate
            billCount
            totalAmount
            cashTotal
            upiTotal
            cardTotal
            discountTotal
            taxTotal
            bills {
                id
                billNo
                billDate
                billTime
                customerName
                customerPhone
                salesMan
                grandTotal
                cashAmount
                upiAmount
                cardAmount
            }
        }
    }
`);
