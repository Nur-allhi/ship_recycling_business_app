
"use client";

import { useState } from "react";
import { useAppContext } from "@/app/store";
import { LedgerTransaction } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { format } from "date-fns";
import { HandCoins, Trash2 } from "lucide-react";
import { SettlePaymentDialog } from "./settle-payment-dialog";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";


export function PayablesList() {
    const { ledgerTransactions, currency, deleteLedgerTransaction, user } = useAppContext();
    const [settleDialogState, setSettleDialogState] = useState<{isOpen: boolean, transaction: LedgerTransaction | null}>({isOpen: false, transaction: null});
    const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: LedgerTransaction | null}>({isOpen: false, txToDelete: null});
    const isAdmin = user?.role === 'admin';

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
    
    return (
        <>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Balance Due</TableHead>
                            <TableHead className="text-center">Action</TableHead>
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
                                    <TableCell className="text-center space-x-1">
                                        {isAdmin && (
                                            <>
                                                <Button variant="outline" size="sm" onClick={() => handleSettleClick(tx)}>
                                                    <HandCoins className="mr-2 h-4 w-4"/>
                                                    Pay
                                                </Button>
                                                <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => handleDeleteClick(tx)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )})
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">No outstanding payables.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
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
                isPermanent={true}
            />
        </>
    )
}
