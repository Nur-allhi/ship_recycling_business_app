
"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { PayablesList } from './payables-list';
import { ReceivablesList } from './receivables-list';
import { useAppContext } from '@/app/context/app-context';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export function CreditTab() {
    const { currency } = useAppContext();
    const ledgerTransactions = useLiveQuery(() => db.ap_ar_transactions.toArray());

    const { totalPayables, totalReceivables } = React.useMemo(() => {
        if (!ledgerTransactions) return { totalPayables: 0, totalReceivables: 0 };
        const payables = ledgerTransactions.filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        const receivables = ledgerTransactions.filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        const advancesPayable = ledgerTransactions.filter(tx => tx.type === 'advance' && tx.amount < 0).reduce((acc, tx) => acc + Math.abs(tx.amount), 0);
        const advancesReceivable = ledgerTransactions.filter(tx => tx.type === 'advance' && tx.amount > 0).reduce((acc, tx) => acc + tx.amount, 0);
        return { totalPayables: payables - advancesPayable, totalReceivables: receivables - advancesReceivable };
    }, [ledgerTransactions]);

    const formatCurrency = (amount: number): string => {
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

    return (
       <Tabs defaultValue="payables" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payables">Accounts Payable</TabsTrigger>
                <TabsTrigger value="receivables">Accounts Receivable</TabsTrigger>
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
