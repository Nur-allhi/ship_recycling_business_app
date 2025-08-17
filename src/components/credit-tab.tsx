
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

    const payablesContent = (
        <div>
            <div className="p-4 text-center rounded-lg bg-red-50 dark:bg-red-900/20 mb-4">
                <div className="text-sm text-red-600 dark:text-red-300">Total Outstanding</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-200">{formatCurrency(totalPayables)}</div>
            </div>
            <PayablesList />
        </div>
    );

    const receivablesContent = (
        <div>
            <div className="p-4 text-center rounded-lg bg-green-50 dark:bg-green-900/20 mb-4">
                <div className="text-sm text-green-600 dark:text-green-300">Total Outstanding</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-200">{formatCurrency(totalReceivables)}</div>
            </div>
            <ReceivablesList />
        </div>
    );
    
    if (isMobile) {
        return (
            <Tabs defaultValue="payables" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="payables">Payables ({formatCurrency(totalPayables)})</TabsTrigger>
                    <TabsTrigger value="receivables">Receivables ({formatCurrency(totalReceivables)})</TabsTrigger>
                </TabsList>
                <TabsContent value="payables" className="mt-4">
                    {payablesContent}
                </TabsContent>
                <TabsContent value="receivables" className="mt-4">
                    {receivablesContent}
                </TabsContent>
            </Tabs>
        )
    }

    return (
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                {payablesContent}
            </div>
            <div className="space-y-6">
                {receivablesContent}
            </div>
       </div>
    )
}
