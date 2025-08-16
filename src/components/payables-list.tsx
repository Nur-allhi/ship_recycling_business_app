
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


export function PayablesList() {
    const { ledgerTransactions, currency, deleteLedgerTransaction, user } = useAppContext();
    const [settleDialogState, setSettleDialogState] = useState<{isOpen: boolean, transaction: LedgerTransaction | null}>({isOpen: false, transaction: null});
    const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: LedgerTransaction | null}>({isOpen: false, txToDelete: null});
    const isAdmin = user?.role === 'admin';

    const payables = ledgerTransactions.filter(tx => tx.type === 'payable' && tx.status === 'unpaid');
    
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
                            <TableHead>Date</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payables.length > 0 ? (
                            payables.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell className="font-mono">{format(new Date(tx.date), 'dd-MM-yy')}</TableCell>
                                    <TableCell className="font-medium">{tx.contact_name}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold">{formatCurrency(tx.amount)}</TableCell>
                                    <TableCell className="text-center space-x-1">
                                        <Button variant="outline" size="sm" onClick={() => handleSettleClick(tx)}>
                                            <HandCoins className="mr-2 h-4 w-4"/>
                                            Settle
                                        </Button>
                                        {isAdmin && (
                                            <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => handleDeleteClick(tx)}>
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
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
            />
        </>
    )
}

    
