"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAppContext } from '@/app/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { PayablesList } from './payables-list';
import { ReceivablesList } from './receivables-list';

export function CreditTab() {
    const { totalPayables, totalReceivables, currency } = useAppContext();
    const isMobile = useIsMobile();
    
    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const payablesCard = (
        <Card>
            <CardHeader>
                <CardTitle>Accounts Payable</CardTitle>
                <CardDescription>
                    Money you owe to vendors. Total outstanding: <span className="font-bold text-destructive">{formatCurrency(totalPayables)}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <PayablesList />
            </CardContent>
        </Card>
    );

    const receivablesCard = (
         <Card>
            <CardHeader>
                <CardTitle>Accounts Receivable</CardTitle>
                <CardDescription>
                    Money your clients owe you. Total outstanding: <span className="font-bold text-accent">{formatCurrency(totalReceivables)}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ReceivablesList />
            </CardContent>
        </Card>
    );
    
    if (isMobile) {
        return (
            <Tabs defaultValue="payables" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="payables">Payables</TabsTrigger>
                    <TabsTrigger value="receivables">Receivables</TabsTrigger>
                </TabsList>
                <TabsContent value="payables" className="mt-4">
                    {payablesCard}
                </TabsContent>
                <TabsContent value="receivables" className="mt-4">
                    {receivablesCard}
                </TabsContent>
            </Tabs>
        )
    }

    return (
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                {payablesCard}
            </div>
            <div className="space-y-6">
                {receivablesCard}
            </div>
       </div>
    )
}
