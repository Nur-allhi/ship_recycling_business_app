
"use client";

import { useState, useCallback } from 'react';
import { db } from '@/lib/db';
import type { StockItem } from '@/lib/types';

export function useBalanceCalculator() {
    const [cashBalance, setCashBalance] = useState(0);
    const [bankBalance, setBankBalance] = useState(0);
    const [stockItems, setStockItems] = useState<StockItem[] | undefined>([]);
    const [totalPayables, setTotalPayables] = useState(0);
    const [totalReceivables, setTotalReceivables] = useState(0);

    const updateBalances = useCallback(async () => {
        const [allCash, allBank, allLedger, allStock, allInitialStock] = await Promise.all([
            db.cash_transactions.toArray(),
            db.bank_transactions.toArray(),
            db.ap_ar_transactions.toArray(),
            db.stock_transactions.toArray(),
            db.initial_stock.toArray(),
        ]);

        const cash = allCash.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0);
        setCashBalance(cash);

        const bank = allBank.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0);
        setBankBalance(bank);

        const payables = allLedger.filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        setTotalPayables(payables);

        const receivables = allLedger.filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        setTotalReceivables(receivables);
        
        // This is a simplified stock calculation for the dashboard.
        // The more complex running balance is handled in the stock tab itself.
        const stockPortfolio: Record<string, { weight: number, purchasePricePerKg: number }> = {};
        allInitialStock.forEach(item => {
            stockPortfolio[item.name] = { weight: item.weight, purchasePricePerKg: item.purchasePricePerKg };
        });

        allStock.forEach(tx => {
            if (!stockPortfolio[tx.stockItemName]) {
                stockPortfolio[tx.stockItemName] = { weight: 0, purchasePricePerKg: 0 };
            }
            if (tx.type === 'purchase') {
                stockPortfolio[tx.stockItemName].weight += tx.weight;
            } else {
                stockPortfolio[tx.stockItemName].weight -= tx.weight;
            }
        });
        
        const currentStockItems = Object.entries(stockPortfolio)
            .map(([name, { weight, purchasePricePerKg }]) => ({ id: name, name, weight, purchasePricePerKg }));

        setStockItems(currentStockItems);

    }, []);

    return {
        cashBalance,
        bankBalance,
        stockItems,
        totalPayables,
        totalReceivables,
        updateBalances,
    };
}

    