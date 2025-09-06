
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppContext } from "@/app/context/app-context";
import { useAppActions } from "@/app/context/app-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Undo2, Trash2, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveSelect } from "./ui/responsive-select";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { toast } from "sonner";


export function RecycleBinTab() {
    const { 
        deletedCashTransactions, 
        deletedBankTransactions, 
        deletedStockTransactions,
        deletedLedgerTransactions,
        currency,
        user,
        loadRecycleBinData,
        isBinLoading, // Use the new loading state
    } = useAppContext();
    const { 
        restoreTransaction,
        emptyRecycleBin,
    } = useAppActions();
    const [activeTab, setActiveTab] = useState('cash');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const isMobile = useIsMobile();

    const fetchData = useCallback(async () => {
        if (user) {
            await loadRecycleBinData();
        }
    }, [loadRecycleBinData, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
          return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const handleEmptyRecycleBin = () => {
        try {
            emptyRecycleBin();
            setIsDeleteDialogOpen(false);
        } catch (error) {
            toast.error("Failed to empty recycle bin.");
        }
    }

    const hasDeletedItems = [
        ...deletedCashTransactions, 
        ...deletedBankTransactions, 
        ...deletedStockTransactions, 
        ...deletedLedgerTransactions
    ].length > 0;
    
    const tabItems = [
        { value: 'cash', label: `Cash (${deletedCashTransactions.length})` },
        { value: 'bank', label: `Bank (${deletedBankTransactions.length})` },
        { value: 'stock', label: `Stock (${deletedStockTransactions.length})` },
        { value: 'ap_ar', label: `A/R & A/P (${deletedLedgerTransactions.length})` },
    ];

    if(user?.role !== 'admin') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                    <CardDescription>
                        You do not have permission to view the recycle bin.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const renderTable = (items: any[], columns: { key: string, header: string, render?: (item: any) => React.ReactNode }[], txType: 'cash' | 'bank' | 'stock' | 'ap_ar') => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map(col => <TableHead key={col.key}>{col.header}</TableHead>)}
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isBinLoading ? (
                        <TableRow><TableCell colSpan={columns.length + 1} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                    ) : items.length > 0 ? items.map(item => (
                        <TableRow key={item.id}>
                            {columns.map(col => (
                                <TableCell key={col.key}>{col.render ? col.render(item) : item[col.key]}</TableCell>
                            ))}
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => restoreTransaction(txType, item.id)}>
                                    <Undo2 className="h-4 w-4"/>
                                </Button>
                            </TableCell>
                        </TableRow>
                    )) : <TableRow><TableCell colSpan={columns.length + 1} className="text-center h-24">No deleted items in this category.</TableCell></TableRow>}
                </TableBody>
            </Table>
        </div>
    );
    

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <CardTitle>Recycle Bin</CardTitle>
                            <CardDescription>
                                Deleted items are kept here. You can restore them or empty the bin permanently.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button variant="ghost" size="icon" onClick={fetchData} disabled={isBinLoading}>
                                {isBinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                             {hasDeletedItems && (
                                <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Empty Recycle Bin
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        {isMobile ? (
                            <ResponsiveSelect
                                value={activeTab}
                                onValueChange={setActiveTab}
                                items={tabItems}
                                title="Select a category"
                                className="mb-4"
                            />
                        ) : (
                            <TabsList className="grid w-full grid-cols-4">
                                {tabItems.map(item => (
                                    <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
                                ))}
                            </TabsList>
                        )}
                        <TabsContent value="cash" className="mt-4">
                            {renderTable(deletedCashTransactions, [
                                { key: 'deletedAt', header: 'Deleted On', render: (tx) => tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A' },
                                { key: 'description', header: 'Description' },
                                { key: 'actual_amount', header: 'Amount', render: (tx) => <span className={tx.type === 'income' ? 'text-accent' : 'text-destructive'}>{formatCurrency(tx.actual_amount)}</span> },
                            ], 'cash')}
                        </TabsContent>
                        <TabsContent value="bank" className="mt-4">
                             {renderTable(deletedBankTransactions, [
                                { key: 'deletedAt', header: 'Deleted On', render: (tx) => tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A' },
                                { key: 'description', header: 'Description' },
                                { key: 'actual_amount', header: 'Amount', render: (tx) => <span className={tx.type === 'deposit' ? 'text-accent' : 'text-destructive'}>{formatCurrency(tx.actual_amount)}</span> },
                            ], 'bank')}
                        </TabsContent>
                        <TabsContent value="stock" className="mt-4">
                            {renderTable(deletedStockTransactions, [
                                { key: 'deletedAt', header: 'Deleted On', render: (tx) => tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A' },
                                { key: 'stockItemName', header: 'Item' },
                                { key: 'weight', header: 'Weight', render: (tx) => `${tx.weight} kg` },
                                { key: 'actual_amount', header: 'Value', render: (tx) => formatCurrency(tx.actual_amount) },
                            ], 'stock')}
                        </TabsContent>
                        <TabsContent value="ap_ar" className="mt-4">
                           {renderTable(deletedLedgerTransactions, [
                                { key: 'deletedAt', header: 'Deleted On', render: (tx) => tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A' },
                                { key: 'description', header: 'Description' },
                                { key: 'amount', header: 'Amount', render: (tx) => formatCurrency(tx.amount) },
                            ], 'ap_ar')}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
            <DeleteConfirmationDialog 
                isOpen={isDeleteDialogOpen}
                setIsOpen={setIsDeleteDialogOpen}
                onConfirm={handleEmptyRecycleBin}
                itemCount={deletedCashTransactions.length + deletedBankTransactions.length + deletedStockTransactions.length + deletedLedgerTransactions.length}
                isPermanent={true}
            />
        </>
    )
}
