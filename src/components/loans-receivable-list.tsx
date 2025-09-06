"use client";

import { useMemo, useState } from "react";
import { useAppContext } from "@/app/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { format } from "date-fns";

export function LoansReceivableList() {
    const { loans, contacts, currency } = useAppContext();

    const receivableLoans = useMemo(() => {
        return loans
            .filter(loan => loan.type === 'receivable')
            .map(loan => ({
                ...loan,
                contactName: contacts.find(c => c.id === loan.contact_id)?.name || 'Unknown Contact'
            }));
    }, [loans, contacts]);

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Loans Receivable</CardTitle>
                <CardDescription>Money you have lent to others.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Borrower</TableHead>
                            <TableHead>Principal</TableHead>
                            <TableHead>Issue Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {receivableLoans.length > 0 ? (
                           receivableLoans.map(loan => (
                                <TableRow key={loan.id}>
                                    <TableCell className="font-medium">{loan.contactName}</TableCell>
                                    <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                                    <TableCell>{format(new Date(loan.issue_date), 'dd-MM-yyyy')}</TableCell>
                                    <TableCell><Badge className="capitalize">{loan.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm">View Details</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No receivable loans recorded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}