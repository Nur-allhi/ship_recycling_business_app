
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAppContext } from '@/app/context/app-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { PayablesList } from './payables-list';
import { ReceivablesList } from './receivables-list';
import { ResponsiveSelect } from './ui/responsive-select';

export function CreditTab() {
    const { totalPayables, totalReceivables, currency } = useAppContext();
    const [mobileView, setMobileView] = useState<'payables' | 'receivables'>('payables');
    const isMobile = useIsMobile();
    
    const formatCurrency = (amount: number) => {
        if (amount < 0) {
            return `-${formatCurrency(Math.abs(amount))}`;
        }
        if (currency === 'BDT') {
            return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const payablesContent = (
        <div>
            <div className="p-4 text-center rounded-lg bg-red-50 dark:bg-red-900/20 mb-4">
                <div className="text-sm text-red-600 dark:text-red-300">Total Outstanding</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-200">{formatCurrency(totalPayables)}</div>
                 {totalPayables < 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">(You have an advance credit of {formatCurrency(Math.abs(totalPayables))})</p>
                )}
            </div>
            <PayablesList />
        </div>
    );

    const receivablesContent = (
        <div>
            <div className="p-4 text-center rounded-lg bg-green-50 dark:bg-green-900/20 mb-4">
                <div className="text-sm text-green-600 dark:text-green-300">Total Outstanding</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-200">{formatCurrency(totalReceivables)}</div>
                 {totalReceivables < 0 && (
                    <p className="text-xs text-green-500 dark:text-green-400 mt-1">(Clients have an advance credit of {formatCurrency(Math.abs(totalReceivables))})</p>
                )}
            </div>
            <ReceivablesList />
        </div>
    );
    
    if (isMobile) {
        return (
            <div className="space-y-4">
                <ResponsiveSelect 
                    value={mobileView}
                    onValueChange={(value) => setMobileView(value as any)}
                    title="Select View"
                    items={[
                        { value: 'payables', label: `Payables (${formatCurrency(totalPayables)})` },
                        { value: 'receivables', label: `Receivables (${formatCurrency(totalReceivables)})` },
                    ]}
                />
                {mobileView === 'payables' ? payablesContent : receivablesContent}
            </div>
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

    
