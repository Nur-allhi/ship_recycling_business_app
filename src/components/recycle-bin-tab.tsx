
"use client";

import { useEffect, useState } from "react";
import { useAppContext } from "@/app/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Undo2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveSelect } from "./ui/responsive-select";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { toast } from "sonner";


export function RecycleBinTab() {
    const { 
        loadRecycleBinData, 
        deletedCashTransactions, 
        deletedBankTransactions, 
        deletedStockTransactions,
        deletedLedgerTransactions,
        restoreTransaction,
        emptyRecycleBin,
        currency,
        user
    } = useAppContext();
    const [activeTab, setActiveTab] = useState('cash');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        if(user?.role === 'admin') {
            loadRecycleBinData();
        }
    }, [loadRecycleBinData, user]);

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
                         {hasDeletedItems && (
                            <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Empty Recycle Bin
                            </Button>
                        )}
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
                                                <TableCell className={tx.type === 'income' ? 'text-accent' : 'text-destructive'}>{formatCurrency(tx.actual_amount)}</TableCell>
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
                                                <TableCell className={tx.type === 'deposit' ? 'text-accent' : 'text-destructive'}>{formatCurrency(tx.actual_amount)}</TableCell>
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
                                                <TableCell>{formatCurrency(tx.actual_amount)}</TableCell>
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
                        <TabsContent value="ap_ar" className="mt-4">
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
                                        {deletedLedgerTransactions.length > 0 ? deletedLedgerTransactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{tx.deletedAt ? format(new Date(tx.deletedAt), "dd-MM-yyyy") : 'N/A'}</TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell>{formatCurrency(tx.amount)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => restoreTransaction('ap_ar', tx.id)}>
                                                        <Undo2 className="h-4 w-4"/>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No deleted A/R or A/P transactions.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
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
    

    
