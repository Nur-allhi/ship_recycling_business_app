
"use client";

import { useState, useMemo } from "react";
import { useAppContext } from "@/app/store";
import { LedgerTransaction } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { HandCoins } from "lucide-react";
import { SettlePaymentDialog } from "./settle-payment-dialog";
import { Progress } from "./ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface AggregatedContact {
    contact_id: string;
    contact_name: string;
    total_amount: number;
    total_paid: number;
    type: 'payable';
}

export function PayablesList() {
    const { ledgerTransactions, currency, user } = useAppContext();
    const [settleDialogState, setSettleDialogState] = useState<{isOpen: boolean, contact: AggregatedContact | null}>({isOpen: false, contact: null});
    const isMobile = useIsMobile();
    const isAdmin = user?.role === 'admin';

    const payablesByContact = useMemo(() => {
        const unpaidTxs = ledgerTransactions.filter(tx => tx.type === 'payable' && tx.status !== 'paid');
        const groups: Record<string, AggregatedContact> = {};

        unpaidTxs.forEach(tx => {
            if (!groups[tx.contact_id]) {
                groups[tx.contact_id] = {
                    contact_id: tx.contact_id,
                    contact_name: tx.contact_name,
                    total_amount: 0,
                    total_paid: 0,
                    type: 'payable'
                };
            }
            groups[tx.contact_id].total_amount += tx.amount;
            groups[tx.contact_id].total_paid += tx.paid_amount;
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
        setSettleDialogState({ isOpen: true, contact });
    }

    const renderDesktopView = () => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        <TableHead className="text-center">Settle</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payablesByContact.length > 0 ? (
                        payablesByContact.map(contact => {
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
                                            <TooltipContent><p>Settle Payment</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                            </TableRow>
                        )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center h-24">No outstanding payables.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
    
    const renderMobileView = () => (
        <div className="space-y-4">
            {payablesByContact.length > 0 ? (
                payablesByContact.map(contact => {
                    const remainingBalance = contact.total_amount - contact.total_paid;
                    const progress = (contact.total_paid / contact.total_amount) * 100;
                    return (
                        <Card key={contact.contact_id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold">{contact.contact_name}</div>
                                        <div className="text-sm text-muted-foreground">Outstanding Balance</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-destructive text-lg">{formatCurrency(remainingBalance)}</div>
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
                                            Settle Payment
                                        </Button>
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
                    </div>
                </CardHeader>
                <CardContent>
                    {isMobile ? renderMobileView() : renderDesktopView()}
                </CardContent>
            </Card>

            {settleDialogState.contact && (
                <SettlePaymentDialog 
                    isOpen={settleDialogState.isOpen}
                    setIsOpen={(isOpen) => setSettleDialogState({ isOpen, contact: isOpen ? settleDialogState.contact : null })}
                    contact={settleDialogState.contact}
                />
            )}
        </>
    )
}
