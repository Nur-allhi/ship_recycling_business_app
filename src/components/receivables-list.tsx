
"use client";

import { useState } from "react";
import { useAppContext } from "@/app/store";
import { LedgerTransaction } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { format } from "date-fns";
import { HandCoins } from "lucide-react";
import { SettlePaymentDialog } from "./settle-payment-dialog";


export function ReceivablesList() {
    const { ledgerTransactions, currency, clients } = useAppContext();
    const [settleDialogState, setSettleDialogState] = useState<{isOpen: boolean, transaction: LedgerTransaction | null}>({isOpen: false, transaction: null});

    const receivables = ledgerTransactions.filter(tx => tx.type === 'receivable' && tx.status === 'unpaid');
    
    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const handleSettleClick = (tx: LedgerTransaction) => {
        setSettleDialogState({ isOpen: true, transaction: tx });
    }
    
    const getClientName = (contactId: string): string => {
        const client = clients.find(c => c.id === contactId);
        return client ? client.name : 'N/A';
    }

    return (
        <>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {receivables.length > 0 ? (
                            receivables.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell className="font-mono">{format(new Date(tx.date), 'dd-MM-yy')}</TableCell>
                                    <TableCell className="font-medium">{getClientName(tx.contact_id)}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold">{formatCurrency(tx.amount)}</TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="outline" size="sm" onClick={() => handleSettleClick(tx)}>
                                            <HandCoins className="mr-2 h-4 w-4"/>
                                            Settle
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">No outstanding receivables.</TableCell>
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
        </>
    )
}
