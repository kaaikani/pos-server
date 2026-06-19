import { defineDashboardExtension } from '@vendure/dashboard';
import { PharmaPurchaseFormPage } from './purchase.form.page.js';
import { PharmaPurchaseListPage } from './purchase.list.page.js';
import { PharmaSalesReportPage } from './sales-report.page.js';
import { PharmaStockPage } from './stock.page.js';

defineDashboardExtension({
    routes: [
        {
            path: '/pharma/purchases',
            component: () => <PharmaPurchaseListPage />,
            navMenuItem: {
                sectionId: 'sales',
                id: 'pharma-purchases',
                title: 'Purchases',
                url: '/pharma/purchases',
                order: 190,
            },
        },
        {
            path: '/pharma/purchases/new',
            component: () => <PharmaPurchaseFormPage />,
        },
        {
            path: '/pharma/sales-report',
            component: () => <PharmaSalesReportPage />,
            navMenuItem: {
                sectionId: 'sales',
                id: 'pharma-sales-report',
                title: 'Sales Report',
                url: '/pharma/sales-report',
                order: 200,
            },
        },
        {
            path: '/pharma/stock',
            component: () => <PharmaStockPage />,
            navMenuItem: {
                sectionId: 'sales',
                id: 'pharma-stock',
                title: 'Current Stock',
                url: '/pharma/stock',
                order: 210,
            },
        },
    ],
});
