import { Badge } from '@/vdb/components/ui/badge.js';
import { Button } from '@/vdb/components/ui/button.js';
import { Card, CardContent } from '@/vdb/components/ui/card.js';
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
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
    createPharmaPurchaseMutation,
    itemsForPurchasePickerQuery,
    posUnitsQuery,
} from './purchase.graphql.js';

const PAY_TYPES = ['Cash', 'Credit', 'UPI', 'Card', 'Cheque'];
const STATES = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Delhi',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Puducherry',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
];

type Row = {
    rowKey: number;
    itemId: number | null;
    itemCode: string;
    itemName: string;
    description: string;
    count: number;
    mrpRate: number;
    qty: number;
    unit: string;
    puRate: number;
    taxMode: string;
    discountPct: number;
    discountFlat: number;
    taxPct: number;
    amount: number;
};

function emptyRow(rowKey: number): Row {
    return {
        rowKey,
        itemId: null,
        itemCode: '',
        itemName: '',
        description: '',
        count: 0,
        mrpRate: 0,
        qty: 0,
        unit: '',
        puRate: 0,
        taxMode: 'Without Tax',
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
        amount: 0,
    };
}

function computeRowAmount(r: Row): number {
    const lineGross = r.qty * r.puRate;
    const discountAmt = r.discountFlat > 0 ? r.discountFlat : (lineGross * r.discountPct) / 100;
    const taxable = Math.max(0, lineGross - discountAmt);
    const taxAmt = (taxable * r.taxPct) / 100;
    return Math.round((taxable + taxAmt) * 100) / 100;
}

function todayDdMmYyyy(): string {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function autoBillNumber(): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const seq = Math.floor(Date.now() / 1000) % 10000;
    return `PUR-${ymd}-${String(seq).padStart(4, '0')}`;
}

export function PharmaPurchaseFormPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [purNo, setPurNo] = useState(autoBillNumber());
    const [purDate, setPurDate] = useState(todayDdMmYyyy());
    const [supplier, setSupplier] = useState('');
    const [supplierPhone, setSupplierPhone] = useState('');
    const [stateOfSupply, setStateOfSupply] = useState('Tamil Nadu');
    const [payType, setPayType] = useState('Cash');
    const [billDiscountPct, setBillDiscountPct] = useState(0);
    const [billDiscountAmt, setBillDiscountAmt] = useState(0);
    const [roundOff, setRoundOff] = useState(true);
    const [remarks, setRemarks] = useState('');

    const [rows, setRows] = useState<Row[]>([emptyRow(1)]);
    const [nextKey, setNextKey] = useState(2);
    const [error, setError] = useState<string | null>(null);

    const itemsQ = useQuery({
        queryKey: ['itemsForPurchasePicker'],
        queryFn: () => api.query(itemsForPurchasePickerQuery, {}),
    });

    const unitsQ = useQuery({
        queryKey: ['posUnits'],
        queryFn: () => api.query(posUnitsQuery, {}),
    });

    const items = ((itemsQ.data?.pharmaItems ?? []) as any[]);
    const units = ((unitsQ.data?.posUnits ?? []) as any[]);

    const createMut = useMutation({
        mutationFn: (payload: any) => api.mutate(createPharmaPurchaseMutation, { input: payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmaPurchases'] });
            queryClient.invalidateQueries({ queryKey: ['pharmaCurrentStock'] });
            navigate({ to: '/pharma/purchases' as any });
        },
        onError: (e: any) => setError(e?.message ?? 'Failed to save purchase.'),
    });

    function setRow(rowKey: number, patch: Partial<Row>) {
        setRows(prev =>
            prev.map(r => {
                if (r.rowKey !== rowKey) return r;
                const next = { ...r, ...patch };
                next.amount = computeRowAmount(next);
                return next;
            }),
        );
    }

    function addRow() {
        setRows(prev => [...prev, emptyRow(nextKey)]);
        setNextKey(k => k + 1);
    }

    function removeRow(rowKey: number) {
        setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.rowKey !== rowKey)));
    }

    function pickItem(rowKey: number, itemId: number | null) {
        if (itemId == null) {
            setRow(rowKey, {
                itemId: null,
                itemCode: '',
                itemName: '',
                mrpRate: 0,
                puRate: 0,
                taxPct: 0,
                taxMode: 'Without Tax',
                unit: '',
            });
            return;
        }
        const it = items.find((x: any) => x.id === itemId);
        if (!it) return;
        setRow(rowKey, {
            itemId: it.id,
            itemCode: it.code,
            itemName: it.itemName,
            mrpRate: it.mrpRate ?? 0,
            puRate: it.purchaseRate ?? 0,
            taxPct: it.gstPercent ?? 0,
            taxMode: it.purchaseTaxMode ?? 'Without Tax',
            unit: it.unit ?? '',
        });
    }

    const totals = useMemo(() => {
        const subtotal = rows.reduce((acc, r) => acc + r.qty * r.puRate, 0);
        const rowDiscount = rows.reduce((acc, r) => {
            const lineGross = r.qty * r.puRate;
            const d = r.discountFlat > 0 ? r.discountFlat : (lineGross * r.discountPct) / 100;
            return acc + d;
        }, 0);
        const rowTax = rows.reduce((acc, r) => {
            const lineGross = r.qty * r.puRate;
            const d = r.discountFlat > 0 ? r.discountFlat : (lineGross * r.discountPct) / 100;
            const taxable = Math.max(0, lineGross - d);
            return acc + (taxable * r.taxPct) / 100;
        }, 0);
        const rowsSum = rows.reduce((acc, r) => acc + r.amount, 0);
        const billDiscountFinal = billDiscountAmt > 0 ? billDiscountAmt : (rowsSum * billDiscountPct) / 100;
        const net = rowsSum - billDiscountFinal;
        const rounded = roundOff ? Math.round(net) : net;
        return {
            subtotal,
            rowDiscount,
            rowTax,
            rowsSum,
            billDiscountFinal,
            roundOffAmount: roundOff ? rounded - net : 0,
            netAmount: rounded,
        };
    }, [rows, billDiscountAmt, billDiscountPct, roundOff]);

    function clientValidate(): string | null {
        if (!supplier.trim()) return 'Supplier name is required.';
        if (!purNo.trim()) return 'Bill Number is required.';
        if (!purDate.trim()) return 'Bill Date is required.';
        const validRows = rows.filter(r => r.itemId != null);
        if (validRows.length === 0) return 'At least one item row is required.';
        for (let i = 0; i < validRows.length; i++) {
            const r = validRows[i];
            if (!r.itemCode || !r.itemName) {
                return `Row ${i + 1}: Item is required.`;
            }
            if (r.qty <= 0) {
                return `Row ${i + 1} ("${r.itemName}"): Quantity must be > 0.`;
            }
            if (r.puRate <= 0) {
                return `Row ${i + 1} ("${r.itemName}"): Purchase Rate must be > 0.`;
            }
        }
        return null;
    }

    function onSave() {
        setError(null);
        const err = clientValidate();
        if (err) {
            setError(err);
            return;
        }
        const validRows = rows.filter(r => r.itemId != null);
        const payload = {
            purNo: purNo.trim(),
            purDate: purDate.trim(),
            supplier: supplier.trim(),
            supplierPhone: supplierPhone.trim(),
            stateOfSupply,
            payType,
            rows: validRows.map(r => ({
                itemCode: r.itemCode,
                itemName: r.itemName,
                description: r.description || undefined,
                count: r.count || undefined,
                unit: r.unit || undefined,
                qty: r.qty,
                puRate: r.puRate,
                mrpRate: r.mrpRate,
                discountPct: r.discountPct,
                discountFlat: r.discountFlat,
                taxPct: r.taxPct,
                amount: r.amount,
            })),
            totalAmount: totals.rowsSum,
            totalDiscA: totals.rowDiscount + totals.billDiscountFinal,
            totalTax: totals.rowTax,
            roundOff: totals.roundOffAmount,
            netAmount: totals.netAmount,
            remarks: remarks.trim() || undefined,
        };
        createMut.mutate(payload);
    }

    return (
        <Page pageId="pharma-purchase-form">
            <PageTitle>Purchase</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button variant="outline" onClick={() => navigate({ to: '/pharma/purchases' as any })}>
                        <X className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                    <Button onClick={onSave} disabled={createMut.isPending}>
                        <Save className="mr-1 h-4 w-4" />
                        {createMut.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </PageActionBarRight>
            </PageActionBar>

            <PageLayout>
                {error ? (
                    <FullWidthPageBlock blockId="error">
                        <Card className="border-destructive">
                            <CardContent className="pt-4 text-destructive">{error}</CardContent>
                        </Card>
                    </FullWidthPageBlock>
                ) : null}

                <FullWidthPageBlock blockId="header">
                    <Card>
                        <CardContent className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-4">
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <Label>Supplier *</Label>
                                    <Input
                                        placeholder="Search by Name / Phone *"
                                        value={supplier}
                                        onChange={e => setSupplier(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label>Phone No.</Label>
                                    <Input
                                        placeholder="Phone No."
                                        value={supplierPhone}
                                        onChange={e => setSupplierPhone(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label>Bill Number</Label>
                                <Input value={purNo} onChange={e => setPurNo(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label>Bill Date</Label>
                                <Input
                                    value={purDate}
                                    onChange={e => setPurDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>
                            <div className="md:col-span-2 flex flex-col gap-1">
                                <Label>State of Supply</Label>
                                <select
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                    value={stateOfSupply}
                                    onChange={e => setStateOfSupply(e.target.value)}
                                >
                                    {STATES.map(s => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                </FullWidthPageBlock>

                <FullWidthPageBlock blockId="rows">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b text-left">
                                        <tr>
                                            <th className="py-2 pr-2 w-10">#</th>
                                            <th className="py-2 pr-2 min-w-[180px]">ITEM *</th>
                                            <th className="py-2 pr-2 min-w-[140px]">DESCRIPTION</th>
                                            <th className="py-2 pr-2 w-16">COUNT</th>
                                            <th className="py-2 pr-2 w-20">MRP</th>
                                            <th className="py-2 pr-2 w-16">QTY *</th>
                                            <th className="py-2 pr-2 w-20">UNIT</th>
                                            <th className="py-2 pr-2 w-24">PRICE/UNIT *</th>
                                            <th className="py-2 pr-2 w-20">DISC %</th>
                                            <th className="py-2 pr-2 w-24">DISC AMT</th>
                                            <th className="py-2 pr-2 w-20">TAX %</th>
                                            <th className="py-2 pr-2 w-24 text-right">AMOUNT</th>
                                            <th className="py-2 pr-2 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, idx) => (
                                            <tr key={r.rowKey} className="border-b">
                                                <td className="py-2 pr-2 text-muted-foreground">
                                                    {idx + 1}
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <ItemPicker
                                                        items={items}
                                                        value={r.itemId}
                                                        onChange={id => pickItem(r.rowKey, id)}
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        value={r.description}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                description: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        type="number"
                                                        value={r.count || ''}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                count: parseFloat(e.target.value) || 0,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        type="number"
                                                        value={r.mrpRate || ''}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                mrpRate: parseFloat(e.target.value) || 0,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        type="number"
                                                        value={r.qty || ''}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                qty: parseFloat(e.target.value) || 0,
                                                            })
                                                        }
                                                        className={
                                                            r.itemId && r.qty <= 0
                                                                ? 'border-destructive'
                                                                : ''
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <select
                                                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                                        value={r.unit}
                                                        onChange={e =>
                                                            setRow(r.rowKey, { unit: e.target.value })
                                                        }
                                                    >
                                                        <option value="">NONE</option>
                                                        {units.map((u: any) => (
                                                            <option key={u.id} value={u.code}>
                                                                {u.code}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        type="number"
                                                        value={r.puRate || ''}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                puRate: parseFloat(e.target.value) || 0,
                                                            })
                                                        }
                                                        className={
                                                            r.itemId && r.puRate <= 0
                                                                ? 'border-destructive'
                                                                : ''
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        type="number"
                                                        value={r.discountPct || ''}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                discountPct:
                                                                    parseFloat(e.target.value) || 0,
                                                                discountFlat: 0,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        type="number"
                                                        value={r.discountFlat || ''}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                discountFlat:
                                                                    parseFloat(e.target.value) || 0,
                                                                discountPct: 0,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2">
                                                    <Input
                                                        type="number"
                                                        value={r.taxPct || ''}
                                                        onChange={e =>
                                                            setRow(r.rowKey, {
                                                                taxPct: parseFloat(e.target.value) || 0,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="py-2 pr-2 text-right font-medium">
                                                    {r.amount.toFixed(2)}
                                                </td>
                                                <td className="py-2 pr-2 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeRow(r.rowKey)}
                                                        disabled={rows.length <= 1}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="font-medium">
                                            <td colSpan={5} className="py-2">
                                                <Button variant="ghost" size="sm" onClick={addRow}>
                                                    <Plus className="mr-1 h-4 w-4" /> Add Row
                                                </Button>
                                            </td>
                                            <td className="py-2 pr-2 text-right">
                                                {rows.reduce((a, r) => a + r.qty, 0).toFixed(2)}
                                            </td>
                                            <td colSpan={2} />
                                            <td className="py-2 pr-2 text-right">
                                                {totals.rowDiscount.toFixed(2)}
                                            </td>
                                            <td className="py-2 pr-2 text-right">
                                                {totals.rowTax.toFixed(2)}
                                            </td>
                                            <td className="py-2 pr-2 text-right">
                                                {totals.rowsSum.toFixed(2)}
                                            </td>
                                            <td />
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </FullWidthPageBlock>

                <FullWidthPageBlock blockId="footer">
                    <Card>
                        <CardContent className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-3">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <Label>Terms / Remarks</Label>
                                    <Input
                                        value={remarks}
                                        onChange={e => setRemarks(e.target.value)}
                                        placeholder="Thanks for doing business with us!"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Label>Payment Type</Label>
                                <div className="flex flex-wrap gap-2">
                                    {PAY_TYPES.map(p => (
                                        <Badge
                                            key={p}
                                            variant={payType === p ? 'default' : 'outline'}
                                            className="cursor-pointer px-3 py-1"
                                            onClick={() => setPayType(p)}
                                        >
                                            {p}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-2 items-end">
                                    <Label>Bill Discount %</Label>
                                    <Input
                                        type="number"
                                        value={billDiscountPct || ''}
                                        onChange={e => {
                                            setBillDiscountPct(parseFloat(e.target.value) || 0);
                                            setBillDiscountAmt(0);
                                        }}
                                    />
                                    <Label>Bill Discount ₹</Label>
                                    <Input
                                        type="number"
                                        value={billDiscountAmt || ''}
                                        onChange={e => {
                                            setBillDiscountAmt(parseFloat(e.target.value) || 0);
                                            setBillDiscountPct(0);
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="roundOff"
                                        type="checkbox"
                                        checked={roundOff}
                                        onChange={e => setRoundOff(e.target.checked)}
                                    />
                                    <Label htmlFor="roundOff">
                                        Round Off ({totals.roundOffAmount.toFixed(2)})
                                    </Label>
                                </div>
                                <div className="rounded-md bg-muted/40 px-3 py-2 flex justify-between">
                                    <span className="font-semibold">Total</span>
                                    <span className="font-bold text-lg">
                                        ₹ {totals.netAmount.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </FullWidthPageBlock>
            </PageLayout>
        </Page>
    );
}

function ItemPicker({
    items,
    value,
    onChange,
}: {
    items: any[];
    value: number | null;
    onChange: (id: number | null) => void;
}) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const selected = items.find(x => x.id === value);
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return items.slice(0, 50);
        return items
            .filter(
                (it: any) =>
                    String(it.itemName).toLowerCase().includes(term) ||
                    String(it.code).toLowerCase().includes(term) ||
                    String(it.barcode ?? '').toLowerCase().includes(term),
            )
            .slice(0, 50);
    }, [items, q]);

    return (
        <div className="relative">
            <Input
                value={open ? q : selected?.itemName ?? ''}
                placeholder="Search item by name / code / barcode"
                onFocus={() => {
                    setOpen(true);
                    setQ('');
                }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => setQ(e.target.value)}
            />
            {open && filtered.length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                    {filtered.map((it: any) => (
                        <div
                            key={it.id}
                            className="cursor-pointer px-2 py-1.5 text-sm hover:bg-muted"
                            onMouseDown={() => {
                                onChange(it.id);
                                setOpen(false);
                            }}
                        >
                            <div className="font-medium">{it.itemName}</div>
                            <div className="text-xs text-muted-foreground">
                                {it.code} · {it.unit} · ₹{it.purchaseRate}{' '}
                                {it.purchaseRate <= 0 ? '(no purchase rate set)' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            {open && filtered.length === 0 ? (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover px-2 py-2 text-xs text-muted-foreground shadow-md">
                    No match. Create the item in Item Master first.
                </div>
            ) : null}
        </div>
    );
}
