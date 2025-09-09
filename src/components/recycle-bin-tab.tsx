
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppContext } from "@/app/context/app-context";
import { useAppActions } from "@/app/context/app-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Undo2, Trash2, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveSelect } from "./ui/responsive-select";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { toast } from "sonner";
import * as server from "@/lib/actions";
import type { CashTransaction, BankTransaction, StockTransaction, LedgerTransaction } from "@/lib/types";


export function RecycleBinTab() {
    const { currency, user } = useAppContext();
    const { restoreTransaction, emptyRecycleBin } = useAppActions();

    const [deletedItems, setDeletedItems] = useState<{ cash: CashTransaction[], bank: BankTransaction[], stock: StockTransaction[], ap_ar: LedgerTransaction[] }>({ cash: [], bank: [], stock: [], ap_ar: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('cash');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const isMobile = useIsMobile();

    const fetchData = useCallback(async () => {
        if (!user || user.role !== 'admin') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [cash, bank, stock, ap_ar] = await Promise.all([
                server.readDeletedData({ tableName: 'cash_transactions', select: '*' }),
                server.readDeletedData({ tableName: 'bank_transactions', select: '*' }),
                server.readDeletedData({ tableName: 'stock_transactions', select: '*' }),
                server.readDeletedData({ tableName: 'ap_ar_transactions', select: '*' }),
            ]);
            setDeletedItems({
                cash: (cash as CashTransaction[]) || [],
                bank: (bank as BankTransaction[]) || [],
                stock: (stock as StockTransaction[]) || [],
                ap_ar: (ap_ar as LedgerTransaction[]) || []
            });
        } catch (error: any) {
            toast.error("Failed to load recycle bin", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
          return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const handleEmptyRecycleBin = async () => {
        try {
            await emptyRecycleBin();
            setIsDeleteDialogOpen(false);
            // After emptying, refresh the data to show an empty bin
            fetchData();
        } catch (error) {
            toast.error("Failed to empty recycle bin.");
        }
    }
    
    const handleRestore = async (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => {
        try {
            await restoreTransaction(txType, id);
            // Refresh data after restoring
            fetchData();
        } catch(e) {
            // Error is already handled by restoreTransaction
        }
    }

    const hasDeletedItems = [
        ...deletedItems.cash, 
        ...deletedItems.bank, 
        ...deletedItems.stock, 
        ...deletedItems.ap_ar
    ].length > 0;
    
    const tabItems = [
        { value: 'cash', label: `Cash (${deletedItems.cash.length})` },
        { value: 'bank', label: `Bank (${deletedItems.bank.length})` },
        { value: 'stock', label: `Stock (${deletedItems.stock.length})` },
        { value: 'ap_ar', label: `A/R & A/P (${deletedItems.ap_ar.length})` },
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

    const renderCards = (items: any[], txType: 'cash' | 'bank' | 'stock' | 'ap_ar') => (
        <div className="space-y-4">
             {isLoading ? (
                <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : items.length > 0 ? (
                items.map(item => (
                    <Card key={item.id}>
                        <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex-grow space-y-1">
                                <p className="font-semibold">
                                    {txType === 'stock' ? `${item.stockItemName} (${item.weight}kg)` : item.description}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Amount: <span className="font-mono font-medium text-foreground">{formatCurrency(item.actual_amount || item.amount)}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Deleted on: {item.deletedAt ? format(new Date(item.deletedAt), "dd-MM-yyyy 'at' HH:mm") : 'N/A'}
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleRestore(txType, item.id)} className="w-full sm:w-auto">
                                <Undo2 className="mr-2 h-4 w-4"/>
                                Restore
                            </Button>
                        </CardContent>
                    </Card>
                ))
            ) : (
                 <div className="text-center text-muted-foreground py-12">No deleted items in this category.</div>
            )}
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
                             <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                           {renderCards(deletedItems.cash, 'cash')}
                        </TabsContent>
                        <TabsContent value="bank" className="mt-4">
                            {renderCards(deletedItems.bank, 'bank')}
                        </TabsContent>
                        <TabsContent value="stock" className="mt-4">
                           {renderCards(deletedItems.stock, 'stock')}
                        </TabsContent>
                        <TabsContent value="ap_ar" className="mt-4">
                          {renderCards(deletedItems.ap_ar, 'ap_ar')}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
            <DeleteConfirmationDialog 
                isOpen={isDeleteDialogOpen}
                setIsOpen={setIsDeleteDialogOpen}
                onConfirm={handleEmptyRecycleBin}
                itemCount={deletedItems.cash.length + deletedItems.bank.length + deletedItems.stock.length + deletedItems.ap_ar.length}
                isPermanent={true}
            />
        </>
    )
}
