
"use client";

import { useState, useMemo } from "react";
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

interface AggregatedContact {
    contact_id: string;
    contact_name: string;
    total_amount: number;
    total_paid: number;
    transactions: LedgerTransaction[];
}

export function ReceivablesList() {
    const { ledgerTransactions, currency, deleteLedgerTransaction, user } = useAppContext();
    const [settleDialogState, setSettleDialogState] = useState<{isOpen: boolean, transactions: LedgerTransaction[], contactName: string | null}>({isOpen: false, transactions: [], contactName: null});
    const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: LedgerTransaction | null}>({isOpen: false, txToDelete: null});
    const [showActions, setShowActions] = useState(false);
    const isAdmin = user?.role === 'admin';
    const isMobile = useIsMobile();

    const receivablesByContact = useMemo(() => {
        const unpaidTxs = ledgerTransactions.filter(tx => tx.type === 'receivable' && tx.status !== 'paid');
        const groups: Record<string, AggregatedContact> = {};

        unpaidTxs.forEach(tx => {
            if (!groups[tx.contact_id]) {
                groups[tx.contact_id] = {
                    contact_id: tx.contact_id,
                    contact_name: tx.contact_name,
                    total_amount: 0,
                    total_paid: 0,
                    transactions: [],
                };
            }
            groups[tx.contact_id].total_amount += tx.amount;
            groups[tx.contact_id].total_paid += tx.paid_amount;
            groups[tx.contact_id].transactions.push(tx);
        });

        return Object.values(groups);
    }, [ledgerTransactions]);
    
    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `BDT ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const handleSettleClick = (contact: AggregatedContact) => {
        setSettleDialogState({ isOpen: true, transactions: contact.transactions, contactName: contact.contact_name });
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
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        <TableHead className="text-center">Receive</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {receivablesByContact.length > 0 ? (
                        receivablesByContact.map(contact => {
                            const remainingBalance = contact.total_amount - contact.total_paid;
                            const progress = (contact.total_paid / contact.total_amount) * 100;
                            return (
                            <TableRow key={contact.contact_id}>
                                <TableCell className="font-medium">
                                    <div>{contact.contact_name}</div>
                                     <div className="flex items-center gap-2 mt-1">
                                        <Progress value={progress} className="h-2 w-24" />
                                        <span className="text-xs text-muted-foreground font-mono">{progress.toFixed(0)}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                    <div>{formatCurrency(remainingBalance)}</div>
                                    <div className="text-xs text-muted-foreground font-normal">of {formatCurrency(contact.total_amount)}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleSettleClick(contact)}>
                                                    <HandCoins className="h-4 w-4"/>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Receive Payment</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                            </TableRow>
                        )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center h-24">No outstanding receivables.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
    
    const renderMobileView = () => (
        <div className="space-y-4">
            {receivablesByContact.length > 0 ? (
                receivablesByContact.map(contact => {
                    const remainingBalance = contact.total_amount - contact.total_paid;
                    const progress = (contact.total_paid / contact.total_amount) * 100;
                    return (
                        <Card key={contact.contact_id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold">{contact.contact_name}</div>
                                        <div className="text-sm text-muted-foreground">{contact.transactions.length} open invoice(s)</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-accent text-lg">{formatCurrency(remainingBalance)}</div>
                                        <div className="text-xs text-muted-foreground">of {formatCurrency(contact.total_amount)}</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="h-2 flex-1" />
                                    <span className="text-xs text-muted-foreground font-mono">{progress.toFixed(0)}% paid</span>
                                </div>

                                {isAdmin && (
                                    <div className="flex gap-2 pt-2">
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSettleClick(contact)}>
                                            <HandCoins className="mr-2 h-4 w-4"/>
                                            Receive Payment
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })
            ) : (
                 <div className="text-center text-muted-foreground py-12">No outstanding receivables.</div>
            )}
        </div>
    );
    
    return (
        <>
            <Card>
                <CardHeader>
                     <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Accounts Receivable</CardTitle>
                            <CardDescription>Money your clients owe you.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isMobile ? renderMobileView() : renderDesktopView()}
                </CardContent>
            </Card>

             {settleDialogState.transactions.length > 0 && (
                <SettlePaymentDialog 
                    isOpen={settleDialogState.isOpen}
                    setIsOpen={(isOpen) => setSettleDialogState({ isOpen, transactions: [], contactName: null })}
                    transactions={settleDialogState.transactions}
                    contactName={settleDialogState.contactName!}
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

    