import { graphql } from '@/vdb/graphql/graphql.js';

export const pharmaCurrentStockQuery = graphql(`
    query PharmaCurrentStock($onlyLowStock: Boolean, $onlyStockBased: Boolean) {
        pharmaCurrentStock(onlyLowStock: $onlyLowStock, onlyStockBased: $onlyStockBased) {
            itemCount
            lowStockCount
            stockTrackedCount
            totalStockUnits
            rows {
                id
                code
                itemName
                tamilName
                category
                groupName
                unit
                salesRate
                mrpRate
                currentStock
                minStock
                maxStock
                isStockBased
                isLowStock
            }
        }
    }
`);
