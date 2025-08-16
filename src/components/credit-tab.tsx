
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAppContext } from '@/app/store';

export function CreditTab() {
    const { totalPayables, totalReceivables, currency } = useAppContext();
    
    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    return (
        <Tabs defaultValue="payables" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payables">Accounts Payable (Creditors)</TabsTrigger>
                <TabsTrigger value="receivables">Accounts Receivable (Debtors)</TabsTrigger>
            </TabsList>
            <TabsContent value="payables" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Accounts Payable</CardTitle>
                        <CardDescription>
                            Money you owe to vendors. Total outstanding: <span className="font-bold text-destructive">{formatCurrency(totalPayables)}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Payables list will be implemented here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="receivables" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Accounts Receivable</CardTitle>
                        <CardDescription>
                            Money your clients owe you. Total outstanding: <span className="font-bold text-accent">{formatCurrency(totalReceivables)}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p>Receivables list will be implemented here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
