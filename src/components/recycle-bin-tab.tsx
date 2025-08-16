
"use client";

import { useEffect } from "react";
import { useAppContext } from "@/app/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Undo2 } from "lucide-react";
import { format } from "date-fns";

export function RecycleBinTab() {
    const { 
        loadRecycleBinData, 
        deletedCashTransactions, 
        deletedBankTransactions, 
        deletedStockTransactions,
        deletedLedgerTransactions,
        restoreTransaction,
        currency,
        user
    } = useAppContext();

    useEffect(() => {
        if(user?.role === 'admin') {
            loadRecycleBinData();
        }
    }, [loadRecycleBinData, user]);

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
          return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recycle Bin</CardTitle>
                <CardDescription>
                    Deleted items are kept here for 30 days before permanent deletion. Restore any item by clicking the restore button.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="cash" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="cash">Cash ({deletedCashTransactions.length})</TabsTrigger>
                        <TabsTrigger value="bank">Bank ({deletedBankTransactions.length})</TabsTrigger>
                        <TabsTrigger value="stock">Stock ({deletedStockTransactions.length})</TabsTrigger>
                        <TabsTrigger value="ledger">A/R & A/P ({deletedLedgerTransactions.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="cash" className="mt-4">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Deleted On</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deletedCashTransactions.length > 0 ? deletedCashTransactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A'}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className={tx.type === 'income' ? 'text-accent' : 'text-destructive'}>{formatCurrency(tx.amount)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => restoreTransaction('cash', tx.id)}>
                                                    <Undo2 className="h-4 w-4"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No deleted cash transactions.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                     <TabsContent value="bank" className="mt-4">
                        <div className="overflow-x-auto">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Deleted On</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deletedBankTransactions.length > 0 ? deletedBankTransactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A'}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className={tx.type === 'deposit' ? 'text-accent' : 'text-destructive'}>{formatCurrency(tx.amount)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => restoreTransaction('bank', tx.id)}>
                                                    <Undo2 className="h-4 w-4"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No deleted bank transactions.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                     <TabsContent value="stock" className="mt-4">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Deleted On</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Weight</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deletedStockTransactions.length > 0 ? deletedStockTransactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A'}</TableCell>
                                            <TableCell>{tx.stockItemName}</TableCell>
                                            <TableCell>{tx.weight} kg</TableCell>
                                            <TableCell>{formatCurrency(tx.weight * tx.pricePerKg)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => restoreTransaction('stock', tx.id)}>
                                                    <Undo2 className="h-4 w-4"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center h-24">No deleted stock transactions.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                     <TabsContent value="ledger" className="mt-4">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Deleted On</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deletedLedgerTransactions.length > 0 ? deletedLedgerTransactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A'}</TableCell>
                                            <TableCell>{tx.contact}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className={tx.type === 'receivable' ? 'text-accent' : 'text-destructive'}>{formatCurrency(tx.amount)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => restoreTransaction('ledger', tx.id)}>
                                                    <Undo2 className="h-4 w-4"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center h-24">No deleted A/R or A/P transactions.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
    