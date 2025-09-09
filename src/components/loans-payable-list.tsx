
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

export function LoansPayableList() {
    const { loans, contacts, currency, loanPayments } = useAppContext();
    const [selectedLoan, setSelectedLoan] = useState<LoanWithPayments | null>(null);
    const isMobile = useIsMobile();

    const payableLoans: LoanWithPayments[] = useMemo(() => {
        if (!loans || !contacts || !loanPayments) return [];
        return loans
            .filter(loan => loan.type === 'payable')
            .map(loan => {
                const payments = loanPayments.filter(p => p.loan_id === loan.id);
                const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
                return {
                    ...loan,
                    contactName: contacts.find(c => c.id === loan.contact_id)?.name || 'Unknown Contact',
                    outstanding_balance: loan.principal_amount - totalPaid,
                    payments: payments
                }
            });
    }, [loans, contacts, loanPayments]);

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const renderDesktopView = () => (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Lender</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payableLoans.length > 0 ? (
                        payableLoans.map(loan => (
                            <TableRow key={loan.id}>
                                <TableCell className="font-medium">{loan.contactName}</TableCell>
                                <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                                <TableCell className="font-semibold text-destructive">{formatCurrency(loan.outstanding_balance)}</TableCell>
                                <TableCell>{format(new Date(loan.issue_date), 'dd-MM-yyyy')}</TableCell>
                                <TableCell><Badge className="capitalize">{loan.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => setSelectedLoan(loan)}>View Details</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                No payable loans recorded yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
    
    const renderMobileView = () => (
        <div className="space-y-4">
            {payableLoans.length > 0 ? (
                payableLoans.map(loan => (
                    <Card key={loan.id} onClick={() => setSelectedLoan(loan)} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4 space-y-2">
                             <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold">{loan.contactName}</div>
                                    <div className="text-xs text-muted-foreground">Lender</div>
                                </div>
                                <Badge className="capitalize" variant={loan.status === 'paid' ? 'default' : 'secondary'}>{loan.status}</Badge>
                            </div>
                            <div className="flex justify-between items-baseline pt-2">
                                <div className="space-y-1">
                                    <div className="text-sm font-medium text-destructive">{formatCurrency(loan.outstanding_balance)}</div>
                                    <div className="text-xs text-muted-foreground">Outstanding</div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <div className="text-sm font-medium">{formatCurrency(loan.principal_amount)}</div>
                                    <div className="text-xs text-muted-foreground">Principal</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center text-muted-foreground py-12">No payable loans found.</div>
            )}
        </div>
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Loans Payable</CardTitle>
                    <CardDescription>Money you have borrowed from others.</CardDescription>
                </CardHeader>
                <CardContent>
                   {isMobile ? renderMobileView() : renderDesktopView()}
                </CardContent>
            </Card>
            {selectedLoan && (
                <LoanDetailsDialog 
                    isOpen={!!selectedLoan}
                    setIsOpen={(open) => { if (!open) setSelectedLoan(null) }}
                    loan={selectedLoan}
                />
            )}
        </>
    );
}
