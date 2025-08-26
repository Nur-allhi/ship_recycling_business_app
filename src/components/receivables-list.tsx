
"use client";

import { useState, useMemo } from "react";
import { useAppContext } from "@/app/context/app-context";
import { LedgerTransaction } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { HandCoins, PlusCircle } from "lucide-react";
import { SettlePaymentDialog } from "./settle-payment-dialog";
import { RecordAdvanceDialog } from "./record-advance-dialog";
import { Progress } from "./ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { ContactHistoryDialog } from "./contact-history-dialog";

interface AggregatedContact {
    contact_id: string;
    contact_name: string;
    total_due: number;
    total_paid: number;
    total_advance: number;
    net_balance: number;
    type: 'receivable';
}

export function ReceivablesList() {
    const { ledgerTransactions, currency, user, clients } = useAppContext();
    const [settleDialogState, setSettleDialogState] = useState<{isOpen: boolean, contact: AggregatedContact | null}>({isOpen: false, contact: null});
    const [advanceDialogState, setAdvanceDialogState] = useState<{isOpen: boolean, contact: AggregatedContact | null, ledgerType: 'payable' | 'receivable' | null}>({isOpen: false, contact: null, ledgerType: null});
    const [historyDialogState, setHistoryDialogState] = useState<{isOpen: boolean, contact: AggregatedContact | null}>({isOpen: false, contact: null});
    const isMobile = useIsMobile();
    const isAdmin = user?.role === 'admin';

    const receivablesByContact = useMemo(() => {
        const groups: Record<string, { total_due: number, total_paid: number, total_advance: number, contact_name: string }> = {};

        // Initialize all clients in the groups object
        clients.forEach(client => {
            groups[client.id] = {
                contact_name: client.name,
                total_due: 0,
                total_paid: 0,
                total_advance: 0,
            };
        });

        ledgerTransactions.forEach(tx => {
            // Only process transactions for existing clients or new ones from ledger
            if (tx.type === 'receivable' || (tx.type === 'advance' && clients.some(c => c.id === tx.contact_id))) {
                 if (!groups[tx.contact_id]) {
                    groups[tx.contact_id] = {
                        contact_name: tx.contact_name,
                        total_due: 0,
                        total_paid: 0,
                        total_advance: 0,
                    };
                }
                if (tx.type === 'receivable') {
                    groups[tx.contact_id].total_due += tx.amount;
                    groups[tx.contact_id].total_paid += tx.paid_amount;
                } else if (tx.type === 'advance') {
                    groups[tx.contact_id].total_advance += Math.abs(tx.amount);
                }
            }
        });
        
        return Object.entries(groups).map(([contact_id, group]) => {
            const net_balance = group.total_due - group.total_paid - group.total_advance;
            return {
                contact_id,
                contact_name: group.contact_name,
                total_due: group.total_due,
                total_paid: group.total_paid,
                total_advance: group.total_advance,
                net_balance: net_balance,
                type: 'receivable' as const,
            };
        }).sort((a,b) => b.net_balance - a.net_balance);

    }, [ledgerTransactions, clients]);
    
    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const handleSettleClick = (contact: AggregatedContact) => {
        setSettleDialogState({ isOpen: true, contact });
    }
    
    const handleAdvanceClick = (contact: AggregatedContact) => {
        setAdvanceDialogState({ isOpen: true, contact, ledgerType: 'receivable' });
    }

    const handleHistoryClick = (contact: AggregatedContact) => {
        const fullContact = clients.find(c => c.id === contact.contact_id);
        if (fullContact) {
            setHistoryDialogState({ isOpen: true, contact: fullContact as any });
        }
    }

    const renderDesktopView = () => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-center w-[120px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {receivablesByContact.length > 0 ? (
                        receivablesByContact.map(contact => {
                            const totalCredit = contact.total_paid + contact.total_advance;
                            const progress = contact.total_due > 0 ? (totalCredit / contact.total_due) * 100 : (contact.total_advance > 0 ? 100 : 0);
                            return (
                            <TableRow key={contact.contact_id} className="cursor-pointer" onClick={() => handleHistoryClick(contact)}>
                                <TableCell className="font-medium">
                                    <div>
                                        {contact.contact_name}
                                    </div>
                                     <div className="flex items-center gap-2 mt-1">
                                        <Progress value={progress} className="h-2 w-24" />
                                        <span className="text-xs text-muted-foreground font-mono">{progress.toFixed(0)}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                     {contact.net_balance < 0 ? (
                                         <div className="text-blue-600 dark:text-blue-400">Advance: {formatCurrency(Math.abs(contact.net_balance))}</div>
                                    ) : (
                                        <div>{formatCurrency(contact.net_balance)}</div>
                                    )}
                                    <div className="text-xs text-muted-foreground font-normal">Total Billed: {formatCurrency(contact.total_due)}</div>
                                </TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    {isAdmin && <div className="flex items-center justify-center gap-2">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleSettleClick(contact)} disabled={contact.net_balance <= 0}>
                                                        <HandCoins className="h-4 w-4"/>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Receive Payment</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleAdvanceClick(contact)}>
                                                        <PlusCircle className="h-4 w-4 text-blue-500"/>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Record Advance Received</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>}
                                </TableCell>
                            </TableRow>
                        )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center h-24">No clients found.</TableCell>
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
                    const totalCredit = contact.total_paid + contact.total_advance;
                    const progress = contact.total_due > 0 ? (totalCredit / contact.total_due) * 100 : (contact.total_advance > 0 ? 100 : 0);
                    return (
                        <Card key={contact.contact_id} onClick={() => handleHistoryClick(contact)}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold">
                                            {contact.contact_name}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Balance</div>
                                    </div>
                                    <div className="text-right">
                                        {contact.net_balance < 0 ? (
                                             <div className="font-bold text-blue-600 dark:text-blue-400 text-lg">Advance: {formatCurrency(Math.abs(contact.net_balance))}</div>
                                        ): (
                                            <div className="font-bold text-accent text-lg">{formatCurrency(contact.net_balance)}</div>
                                        )}
                                        <div className="text-xs text-muted-foreground">Total Billed: {formatCurrency(contact.total_due)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="h-2 flex-1" />
                                    <span className="text-xs text-muted-foreground font-mono">{progress.toFixed(0)}% paid</span>
                                </div>

                                {isAdmin && (
                                    <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSettleClick(contact)} disabled={contact.net_balance <= 0}>
                                            <HandCoins className="mr-2 h-4 w-4"/>
                                            Receive
                                        </Button>
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleAdvanceClick(contact)}>
                                            <PlusCircle className="mr-2 h-4 w-4 text-blue-500"/>
                                            Advance
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })
            ) : (
                 <div className="text-center text-muted-foreground py-12">No clients found.</div>
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

             {settleDialogState.contact && (
                <SettlePaymentDialog 
                    isOpen={settleDialogState.isOpen}
                    setIsOpen={(isOpen) => setSettleDialogState({ isOpen, contact: isOpen ? settleDialogState.contact : null })}
                    contact={settleDialogState.contact}
                />
            )}
             {advanceDialogState.contact && (
                <RecordAdvanceDialog
                    isOpen={advanceDialogState.isOpen}
                    setIsOpen={(isOpen) => setAdvanceDialogState({ isOpen, contact: null, ledgerType: null })}
                    contact={advanceDialogState.contact}
                    ledgerType={advanceDialogState.ledgerType!}
                />
            )}
             {historyDialogState.contact && (
                 <ContactHistoryDialog 
                    isOpen={historyDialogState.isOpen}
                    setIsOpen={(isOpen) => setHistoryDialogState({ isOpen, contact: null })}
                    contact={historyDialogState.contact}
                    contactType="client"
                />
            )}
        </>
    )
}
