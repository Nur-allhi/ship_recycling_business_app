
"use client";

import { useState } from "react";
import { useAppContext } from "@/app/store";
import { LedgerTransaction } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { format } from "date-fns";
import { HandCoins, Trash2, Eye, EyeOff } from "lucide-react";
import { SettlePaymentDialog } from "./settle-payment-dialog";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { Progress } from "./ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";


export function PayablesList() {
    const { ledgerTransactions, currency, deleteLedgerTransaction, user } = useAppContext();
    const [settleDialogState, setSettleDialogState] = useState<{isOpen: boolean, transaction: LedgerTransaction | null}>({isOpen: false, transaction: null});
    const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: LedgerTransaction | null}>({isOpen: false, txToDelete: null});
    const [showActions, setShowActions] = useState(false);
    const isAdmin = user?.role === 'admin';
    const isMobile = useIsMobile();

    const payables = ledgerTransactions.filter(tx => tx.type === 'payable' && tx.status !== 'paid');
    
    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const handleSettleClick = (tx: LedgerTransaction) => {
        setSettleDialogState({ isOpen: true, transaction: tx });
    }

    const handleDeleteClick = (tx: LedgerTransaction) => {
        setDeleteDialogState({isOpen: true, txToDelete: tx});
    }

    const confirmDeletion = () => {
        if(deleteDialogState.txToDelete) {
            deleteLedgerTransaction(deleteDialogState.txToDelete);
        }
        setDeleteDialogState({isOpen: false, txToDelete: null});
    }

    const renderDesktopView = () => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        <TableHead className="text-center">Settle</TableHead>
                        {showActions && <TableHead className="text-center">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payables.length > 0 ? (
                        payables.map(tx => {
                            const remainingBalance = tx.amount - tx.paid_amount;
                            const progress = (tx.paid_amount / tx.amount) * 100;

                            return (
                            <TableRow key={tx.id}>
                                <TableCell className="font-medium">
                                    <div>{tx.contact_name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{format(new Date(tx.date), 'dd-MM-yy')}</div>
                                </TableCell>
                                <TableCell>
                                    <div>{tx.description}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Progress value={progress} className="h-2 w-24" />
                                        <span className="text-xs text-muted-foreground font-mono">{progress.toFixed(0)}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                    <div>{formatCurrency(remainingBalance)}</div>
                                    <div className="text-xs text-muted-foreground font-normal">of {formatCurrency(tx.amount)}</div>
                                </TableCell>
                                 <TableCell className="text-center">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleSettleClick(tx)}>
                                                    <HandCoins className="h-4 w-4"/>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Settle Payment</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                                {showActions && (
                                    <TableCell className="text-center">
                                         <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                     <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => handleDeleteClick(tx)}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Delete Entry</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                )}
                            </TableRow>
                        )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={showActions ? 5 : 4} className="text-center h-24">No outstanding payables.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
    
    const renderMobileView = () => (
        <div className="space-y-4">
            {payables.length > 0 ? (
                payables.map(tx => {
                    const remainingBalance = tx.amount - tx.paid_amount;
                    const progress = (tx.paid_amount / tx.amount) * 100;
                    return (
                        <Card key={tx.id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold">{tx.contact_name}</div>
                                        <div className="text-sm text-muted-foreground">{tx.description}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{format(new Date(tx.date), 'PPP')}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-destructive text-lg">{formatCurrency(remainingBalance)}</div>
                                        <div className="text-xs text-muted-foreground">of {formatCurrency(tx.amount)}</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="h-2 flex-1" />
                                    <span className="text-xs text-muted-foreground font-mono">{progress.toFixed(0)}% paid</span>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2 pt-2">
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSettleClick(tx)}>
                                            <HandCoins className="mr-2 h-4 w-4"/>
                                            Settle Payment
                                        </Button>
                                         {showActions && (
                                            <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(tx)}>
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })
            ) : (
                 <div className="text-center text-muted-foreground py-12">No outstanding payables.</div>
            )}
        </div>
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Accounts Payable</CardTitle>
                            <CardDescription>Money you owe to vendors.</CardDescription>
                        </div>
                        {isAdmin && (
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => setShowActions(!showActions)}>
                                            {showActions ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                    <p>{showActions ? 'Hide' : 'Show'} Actions</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isMobile ? renderMobileView() : renderDesktopView()}
                </CardContent>
            </Card>

            {settleDialogState.transaction && (
                <SettlePaymentDialog 
                    isOpen={settleDialogState.isOpen}
                    setIsOpen={(isOpen) => setSettleDialogState({ isOpen, transaction: isOpen ? settleDialogState.transaction : null })}
                    transaction={settleDialogState.transaction}
                />
            )}
             <DeleteConfirmationDialog 
                isOpen={deleteDialogState.isOpen}
                setIsOpen={(isOpen) => setDeleteDialogState({ isOpen: isOpen, txToDelete: null })}
                onConfirm={confirmDeletion}
                itemCount={1}
                isPermanent={false}
            />
        </>
    )
}
