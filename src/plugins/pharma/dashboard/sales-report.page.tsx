import { Button } from '@/vdb/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/vdb/components/ui/card.js';
import { Input } from '@/vdb/components/ui/input.js';
import { Label } from '@/vdb/components/ui/label.js';
import {
    Page,
    PageActionBar,
    PageActionBarRight,
    PageLayout,
    PageTitle,
    FullWidthPageBlock,
} from '@/vdb/framework/layout-engine/page-layout.js';
import { api } from '@/vdb/graphql/api.js';
import { useQuery } from '@tanstack/react-query';
import { Printer, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { pharmaSalesReportQuery } from './sales-report.graphql.js';

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function formatINR(v: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(v || 0);
}

export function PharmaSalesReportPage() {
    const [fromDate, setFromDate] = useState<string>(today());
    const [toDate, setToDate] = useState<string>(today());

    const { data, isFetching, refetch } = useQuery({
        queryKey: ['pharmaSalesReport', fromDate, toDate],
        queryFn: () => api.query(pharmaSalesReportQuery, { fromDate, toDate }),
    });

    const report = data?.pharmaSalesReport as any;

    return (
        <Page pageId="pharma-sales-report">
            <PageTitle>Pharma Sales Report</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="mr-1 h-4 w-4" /> Print
                    </Button>
                    <Button onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </PageActionBarRight>
            </PageActionBar>

            <PageLayout>
                <FullWidthPageBlock blockId="filters">
                    <Card>
                        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="fromDate">From Date</Label>
                                <Input
                                    id="fromDate"
                                    type="date"
                                    value={fromDate}
                                    onChange={e => setFromDate(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="toDate">To Date</Label>
                                <Input
                                    id="toDate"
                                    type="date"
                                    value={toDate}
                                    onChange={e => setToDate(e.target.value)}
                                />
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    const t = today();
                                    setFromDate(t);
                                    setToDate(t);
                                }}
                            >
                                Today
                            </Button>
                        </CardContent>
                    </Card>
                </FullWidthPageBlock>

                <FullWidthPageBlock blockId="summary">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <SummaryCard label="Total Sales" value={formatINR(report?.totalAmount ?? 0)} highlight />
                        <SummaryCard label="Bill Count" value={String(report?.billCount ?? 0)} />
                        <SummaryCard label="Discount" value={formatINR(report?.discountTotal ?? 0)} />
                        <SummaryCard label="Tax" value={formatINR(report?.taxTotal ?? 0)} />
                        <SummaryCard label="Cash" value={formatINR(report?.cashTotal ?? 0)} />
                        <SummaryCard label="UPI" value={formatINR(report?.upiTotal ?? 0)} />
                        <SummaryCard label="Card" value={formatINR(report?.cardTotal ?? 0)} />
                    </div>
                </FullWidthPageBlock>

                <FullWidthPageBlock blockId="bills">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bills</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b text-left">
                                        <tr>
                                            <th className="py-2 pr-3">Bill No</th>
                                            <th className="py-2 pr-3">Date</th>
                                            <th className="py-2 pr-3">Time</th>
                                            <th className="py-2 pr-3">Customer</th>
                                            <th className="py-2 pr-3">Phone</th>
                                            <th className="py-2 pr-3">Sales Man</th>
                                            <th className="py-2 pr-3 text-right">Cash</th>
                                            <th className="py-2 pr-3 text-right">UPI</th>
                                            <th className="py-2 pr-3 text-right">Card</th>
                                            <th className="py-2 pr-3 text-right">Grand Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(report?.bills ?? []).map(b => (
                                            <tr key={String(b.id)} className="border-b last:border-0">
                                                <td className="py-2 pr-3 font-mono">{b.billNo}</td>
                                                <td className="py-2 pr-3">{b.billDate}</td>
                                                <td className="py-2 pr-3">{b.billTime}</td>
                                                <td className="py-2 pr-3">{b.customerName || '-'}</td>
                                                <td className="py-2 pr-3">{b.customerPhone || '-'}</td>
                                                <td className="py-2 pr-3">{b.salesMan || '-'}</td>
                                                <td className="py-2 pr-3 text-right">{formatINR(b.cashAmount)}</td>
                                                <td className="py-2 pr-3 text-right">{formatINR(b.upiAmount)}</td>
                                                <td className="py-2 pr-3 text-right">{formatINR(b.cardAmount)}</td>
                                                <td className="py-2 pr-3 text-right font-semibold">
                                                    {formatINR(b.grandTotal)}
                                                </td>
                                            </tr>
                                        ))}
                                        {!isFetching && (report?.bills ?? []).length === 0 && (
                                            <tr>
                                                <td colSpan={10} className="py-6 text-center text-muted-foreground">
                                                    No sales for the selected date range.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </FullWidthPageBlock>
            </PageLayout>
        </Page>
    );
}

function SummaryCard({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <Card className={highlight ? 'border-primary' : ''}>
            <CardContent className="pt-4">
                <div className="text-xs uppercase text-muted-foreground">{label}</div>
                <div className={`mt-1 text-2xl font-semibold ${highlight ? 'text-primary' : ''}`}>
                    {value}
                </div>
            </CardContent>
        </Card>
    );
}
