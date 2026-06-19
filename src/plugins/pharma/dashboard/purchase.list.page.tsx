import { Badge } from '@/vdb/components/ui/badge.js';
import { Button } from '@/vdb/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/vdb/components/ui/card.js';
import { Input } from '@/vdb/components/ui/input.js';
import { Label } from '@/vdb/components/ui/label.js';
import {
    FullWidthPageBlock,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageLayout,
    PageTitle,
} from '@/vdb/framework/layout-engine/page-layout.js';
import { api } from '@/vdb/graphql/api.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
    deletePharmaPurchaseMutation,
    pharmaPurchasesQuery,
} from './purchase.graphql.js';

function formatINR(v: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(v || 0);
}

export function PharmaPurchaseListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data, isFetching, refetch } = useQuery({
        queryKey: ['pharmaPurchases'],
        queryFn: () => api.query(pharmaPurchasesQuery, {}),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.mutate(deletePharmaPurchaseMutation, { id }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pharmaPurchases'] }),
    });

    const rows = useMemo(() => {
        const all = (data?.pharmaPurchases ?? []) as any[];
        if (!search.trim()) return all;
        const q = search.toLowerCase();
        return all.filter(
            (r: any) =>
                String(r.purNo).toLowerCase().includes(q) ||
                String(r.supplier).toLowerCase().includes(q) ||
                String(r.supplierPhone ?? '').toLowerCase().includes(q),
        );
    }, [data, search]);

    return (
        <Page pageId="pharma-purchases">
            <PageTitle>Purchases</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
                        <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => navigate({ to: '/pharma/purchases/new' as any })}>
                        <Plus className="mr-1 h-4 w-4" /> New Purchase
                    </Button>
                </PageActionBarRight>
            </PageActionBar>

            <PageLayout>
                <FullWidthPageBlock blockId="filters">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="search">Search (bill no / supplier / phone)</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        placeholder="Type to filter…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="pl-8 min-w-[320px]"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </FullWidthPageBlock>

                <FullWidthPageBlock blockId="list">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bills ({rows.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b text-left">
                                        <tr>
                                            <th className="py-2 pr-3">Bill #</th>
                                            <th className="py-2 pr-3">Date</th>
                                            <th className="py-2 pr-3">Supplier</th>
                                            <th className="py-2 pr-3">Phone</th>
                                            <th className="py-2 pr-3">Pay Type</th>
                                            <th className="py-2 pr-3 text-right">Subtotal</th>
                                            <th className="py-2 pr-3 text-right">Discount</th>
                                            <th className="py-2 pr-3 text-right">Tax</th>
                                            <th className="py-2 pr-3 text-right">Total</th>
                                            <th className="py-2 pr-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r: any) => (
                                            <tr key={String(r.id)} className="border-b last:border-0">
                                                <td className="py-2 pr-3 font-mono">{r.purNo}</td>
                                                <td className="py-2 pr-3">{r.purDate}</td>
                                                <td className="py-2 pr-3 font-medium">{r.supplier}</td>
                                                <td className="py-2 pr-3">{r.supplierPhone || '-'}</td>
                                                <td className="py-2 pr-3">
                                                    <Badge variant="secondary">{r.payType || 'Cash'}</Badge>
                                                </td>
                                                <td className="py-2 pr-3 text-right">
                                                    {formatINR(r.totalAmount)}
                                                </td>
                                                <td className="py-2 pr-3 text-right">
                                                    {formatINR(r.totalDiscA)}
                                                </td>
                                                <td className="py-2 pr-3 text-right">
                                                    {formatINR(r.totalTax)}
                                                </td>
                                                <td className="py-2 pr-3 text-right font-semibold">
                                                    {formatINR(r.netAmount)}
                                                </td>
                                                <td className="py-2 pr-3 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (
                                                                window.confirm(
                                                                    `Delete bill "${r.purNo}"? Stock will be reversed.`,
                                                                )
                                                            ) {
                                                                deleteMut.mutate(String(r.id));
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isFetching && rows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={10}
                                                    className="py-6 text-center text-muted-foreground"
                                                >
                                                    No purchase bills yet. Click "New Purchase" to
                                                    create one.
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
