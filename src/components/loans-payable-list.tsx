
"use client";

import { useMemo, useState } from "react";
import { useAppContext } from "@/app/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { format } from "date-fns";

export function LoansPayableList() {
    const { loans, contacts, currency } = useAppContext();

    const payableLoans = useMemo(() => {
        return loans
            .filter(loan => loan.type === 'payable')
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
                <CardTitle>Loans Payable</CardTitle>
                <CardDescription>Money you have borrowed from others.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Lender</TableHead>
                                <TableHead>Principal</TableHead>
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
                                        No payable loans recorded yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
