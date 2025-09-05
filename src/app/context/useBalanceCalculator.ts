
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
        // It now CORRECTLY includes the initial stock.
        const stockPortfolio: Record<string, { weight: number, purchasePricePerKg: number, totalValue: number }> = {};
        
        (allInitialStock || []).forEach(item => {
            if (!stockPortfolio[item.name]) {
                stockPortfolio[item.name] = { weight: 0, purchasePricePerKg: 0, totalValue: 0 };
            }
            stockPortfolio[item.name].weight += item.weight;
            stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
        });

        (allStock || []).forEach(tx => {
            if (!stockPortfolio[tx.stockItemName]) {
                stockPortfolio[tx.stockItemName] = { weight: 0, purchasePricePerKg: 0, totalValue: 0 };
            }
            
            const item = stockPortfolio[tx.stockItemName];
            const currentAvgPrice = item.weight > 0 ? item.totalValue / item.weight : 0;

            if (tx.type === 'purchase') {
                item.weight += tx.weight;
                item.totalValue += tx.weight * tx.pricePerKg;
            } else {
                item.weight -= tx.weight;
                item.totalValue -= tx.weight * currentAvgPrice;
            }
        });
        
        const currentStockItems = Object.entries(stockPortfolio)
            .map(([name, { weight, totalValue }]) => ({ 
                id: name, 
                name, 
                weight, 
                purchasePricePerKg: weight > 0 ? totalValue / weight : 0
            }));

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
