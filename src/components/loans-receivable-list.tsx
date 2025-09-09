
"use client";

import { useMemo, useState } from "react";
import { useAppContext } from "@/app/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import type { Loan, LoanWithPayments } from "@/lib/types";
import { LoanDetailsDialog } from "./loan-details-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface AggregatedContactLoan {
    contact_id: string;
    contactName: string;
    total_principal: number;
    total_outstanding: number;
    loan_count: number;
    status: 'active' | 'paid';
    loans: LoanWithPayments[];
}


export function LoansReceivableList() {
    const { loans, contacts, currency, loanPayments } = useAppContext();
    const [selectedLoan, setSelectedLoan] = useState<LoanWithPayments | null>(null);
    const isMobile = useIsMobile();

    const receivableLoansByContact = useMemo(() => {
        if (!loans || !contacts || !loanPayments) return [];
        const receivableLoans = loans
            .filter(loan => loan.type === 'receivable')
            .map(loan => {
                const payments = loanPayments.filter(p => p.loan_id === loan.id);
                const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
                 return {
                    ...loan,
                    contactName: contacts.find(c => c.id === loan.contact_id)?.name || 'Unknown Contact',
                    outstanding_balance: loan.principal_amount - totalPaid,
                    payments: payments,
                }
            });
        
        const grouped: Record<string, AggregatedContactLoan> = {};

        for (const loan of receivableLoans) {
            if (!grouped[loan.contact_id]) {
                grouped[loan.contact_id] = {
                    contact_id: loan.contact_id,
                    contactName: loan.contactName,
                    total_principal: 0,
                    total_outstanding: 0,
                    loan_count: 0,
                    status: 'active',
                    loans: []
                };
            }
            const group = grouped[loan.contact_id];
            group.total_principal += loan.principal_amount;
            group.total_outstanding += loan.outstanding_balance;
            group.loan_count++;
            group.loans.push(loan);
        }
        
        Object.values(grouped).forEach(group => {
            group.status = group.total_outstanding <= 0 ? 'paid' : 'active';
        });

        return Object.values(grouped);

    }, [loans, contacts, loanPayments]);

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const handleViewDetails = (contactLoan: AggregatedContactLoan) => {
        // For now, we'll just open the first one as an example.
        if (contactLoan.loans.length > 0) {
            setSelectedLoan(contactLoan.loans[0]);
        }
    }
    
    const renderDesktopView = () => (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead># of Loans</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {receivableLoansByContact.length > 0 ? (
                        receivableLoansByContact.map(contactLoan => (
                            <TableRow key={contactLoan.contact_id}>
                                <TableCell className="font-medium">{contactLoan.contactName}</TableCell>
                                <TableCell>{formatCurrency(contactLoan.total_principal)}</TableCell>
                                <TableCell className="font-semibold text-accent">{formatCurrency(contactLoan.total_outstanding)}</TableCell>
                                <TableCell>{contactLoan.loan_count}</TableCell>
                                <TableCell><Badge className="capitalize">{contactLoan.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(contactLoan)}>View Details</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                No receivable loans recorded yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );

    const renderMobileView = () => (
         <div className="space-y-4">
            {receivableLoansByContact.length > 0 ? (
                receivableLoansByContact.map(contactLoan => (
                    <Card key={contactLoan.contact_id} onClick={() => handleViewDetails(contactLoan)} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4 space-y-2">
                             <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold">{contactLoan.contactName}</div>
                                    <div className="text-xs text-muted-foreground">Borrower ({contactLoan.loan_count} loans)</div>
                                </div>
                                <Badge className="capitalize" variant={contactLoan.status === 'paid' ? 'default' : 'secondary'}>{contactLoan.status}</Badge>
                            </div>
                            <div className="flex justify-between items-baseline pt-2">
                                <div className="space-y-1">
                                    <div className="text-sm font-medium text-accent">{formatCurrency(contactLoan.total_outstanding)}</div>
                                    <div className="text-xs text-muted-foreground">Outstanding</div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <div className="text-sm font-medium">{formatCurrency(contactLoan.total_principal)}</div>
                                    <div className="text-xs text-muted-foreground">Principal</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center text-muted-foreground py-12">No receivable loans found.</div>
            )}
        </div>
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Loans Receivable</CardTitle>
                    <CardDescription>Money you have lent to others.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isMobile ? renderMobileView() : renderDesktopView()}
                </CardContent>
            </Card>
            {selectedLoan && (
                <LoanDetailsDialog
                    isOpen={!!selectedLoan}
                    setIsOpen={(open) => { if (!open) setSelectedLoan(null); }}
                    loan={selectedLoan}
                />
            )}
        </>
    );
}
