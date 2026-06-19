import { Badge } from '@/vdb/components/ui/badge.js';
import { Button } from '@/vdb/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/vdb/components/ui/card.js';
import { Input } from '@/vdb/components/ui/input.js';
import { Label } from '@/vdb/components/ui/label.js';
import { Switch } from '@/vdb/components/ui/switch.js';
import {
    FullWidthPageBlock,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageLayout,
    PageTitle,
} from '@/vdb/framework/layout-engine/page-layout.js';
import { api } from '@/vdb/graphql/api.js';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Printer, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { pharmaCurrentStockQuery } from './stock.graphql.js';

function formatINR(v: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(v || 0);
}

export function PharmaStockPage() {
    const [search, setSearch] = useState('');
    const [onlyLowStock, setOnlyLowStock] = useState(false);
    const [onlyStockBased, setOnlyStockBased] = useState(false);

    const { data, isFetching, refetch } = useQuery({
        queryKey: ['pharmaCurrentStock', onlyLowStock, onlyStockBased],
        queryFn: () =>
            api.query(pharmaCurrentStockQuery, {
                onlyLowStock,
                onlyStockBased,
            }),
    });

    const report = data?.pharmaCurrentStock as any;

    const filteredRows = useMemo(() => {
        const rows = report?.rows ?? [];
        if (!search.trim()) return rows;
        const q = search.toLowerCase();
        return rows.filter(
            r =>
                r.code.toLowerCase().includes(q) ||
                r.itemName.toLowerCase().includes(q) ||
                (r.tamilName ?? '').toLowerCase().includes(q) ||
                (r.category ?? '').toLowerCase().includes(q),
        );
    }, [report, search]);

    return (
        <Page pageId="pharma-stock">
            <PageTitle>Current Stock</PageTitle>
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
                <FullWidthPageBlock blockId="summary">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <SummaryCard label="Total Items" value={String(report?.itemCount ?? 0)} />
                        <SummaryCard
                            label="Stock Tracked"
                            value={String(report?.stockTrackedCount ?? 0)}
                        />
                        <SummaryCard
                            label="Low Stock Alerts"
                            value={String(report?.lowStockCount ?? 0)}
                            warn={(report?.lowStockCount ?? 0) > 0}
                        />
                        <SummaryCard
                            label="Total Stock Units"
                            value={String(report?.totalStockUnits ?? 0)}
                        />
                    </div>
                </FullWidthPageBlock>

                <FullWidthPageBlock blockId="filters">
                    <Card>
                        <CardContent className="flex flex-wrap items-end gap-6 pt-4">
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="search">Search (code / name / category)</Label>
                                <Input
                                    id="search"
                                    placeholder="Type to filter…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="min-w-[260px]"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="lowOnly"
                                    checked={onlyLowStock}
                                    onCheckedChange={setOnlyLowStock}
                                />
                                <Label htmlFor="lowOnly">Only Low Stock</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="trackedOnly"
                                    checked={onlyStockBased}
                                    onCheckedChange={setOnlyStockBased}
                                />
                                <Label htmlFor="trackedOnly">Only Stock-Based Items</Label>
                            </div>
                        </CardContent>
                    </Card>
                </FullWidthPageBlock>

                <FullWidthPageBlock blockId="items">
                    <Card>
                        <CardHeader>
                            <CardTitle>Items ({filteredRows.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b text-left">
                                        <tr>
                                            <th className="py-2 pr-3">Code</th>
                                            <th className="py-2 pr-3">Item Name</th>
                                            <th className="py-2 pr-3">Category</th>
                                            <th className="py-2 pr-3">Unit</th>
                                            <th className="py-2 pr-3 text-right">Sales Rate</th>
                                            <th className="py-2 pr-3 text-right">MRP</th>
                                            <th className="py-2 pr-3 text-right">Min</th>
                                            <th className="py-2 pr-3 text-right">Current Stock</th>
                                            <th className="py-2 pr-3">Stock-Based</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.map(r => (
                                            <tr
                                                key={String(r.id)}
                                                className={`border-b last:border-0 ${
                                                    r.isLowStock ? 'bg-destructive/5' : ''
                                                }`}
                                            >
                                                <td className="py-2 pr-3 font-mono">{r.code}</td>
                                                <td className="py-2 pr-3">
                                                    <div className="font-medium">{r.itemName}</div>
                                                    {r.tamilName ? (
                                                        <div className="text-xs text-muted-foreground">
                                                            {r.tamilName}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="py-2 pr-3">{r.category || '-'}</td>
                                                <td className="py-2 pr-3">{r.unit || '-'}</td>
                                                <td className="py-2 pr-3 text-right">
                                                    {formatINR(r.salesRate)}
                                                </td>
                                                <td className="py-2 pr-3 text-right">
                                                    {formatINR(r.mrpRate)}
                                                </td>
                                                <td className="py-2 pr-3 text-right text-muted-foreground">
                                                    {r.minStock}
                                                </td>
                                                <td
                                                    className={`py-2 pr-3 text-right font-semibold ${
                                                        r.isLowStock ? 'text-destructive' : ''
                                                    }`}
                                                >
                                                    <div className="inline-flex items-center justify-end gap-1">
                                                        {r.isLowStock && (
                                                            <AlertTriangle className="h-4 w-4" />
                                                        )}
                                                        {r.currentStock}
                                                    </div>
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {r.isStockBased ? (
                                                        <Badge variant="default">ON</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">OFF</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {!isFetching && filteredRows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="py-6 text-center text-muted-foreground"
                                                >
                                                    No items match the selected filters.
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
    warn,
}: {
    label: string;
    value: string;
    warn?: boolean;
}) {
    return (
        <Card className={warn ? 'border-destructive' : ''}>
            <CardContent className="pt-4">
                <div className="text-xs uppercase text-muted-foreground">{label}</div>
                <div className={`mt-1 text-2xl font-semibold ${warn ? 'text-destructive' : ''}`}>
                    {value}
                </div>
            </CardContent>
        </Card>
    );
}
