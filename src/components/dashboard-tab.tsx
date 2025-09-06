
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAppContext } from "@/app/context/app-context"
import { Wallet, Landmark, Boxes, LineChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";


interface DashboardTabProps {
  setActiveTab: (tab: string) => void;
}

export function DashboardTab({ setActiveTab }: DashboardTabProps) {
  const { currency } = useAppContext()
  
  const cashTransactions = useLiveQuery(() => db.cash_transactions.toArray());
  const bankTransactions = useLiveQuery(() => db.bank_transactions.toArray());
  const stockItems = useLiveQuery(() => db.initial_stock.toArray());
  const stockTransactions = useLiveQuery(() => db.stock_transactions.toArray());

  const isLoading = !cashTransactions || !bankTransactions || !stockItems || !stockTransactions;
  
  const cashBalance = useMemo(() => 
    (cashTransactions || []).reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0), 
    [cashTransactions]
  );
  
  const bankBalance = useMemo(() => 
    (bankTransactions || []).reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0),
    [bankTransactions]
  );

  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const { currentStockWeight, currentStockValue } = useMemo(() => {
    const stockPortfolio: Record<string, { weight: number, totalValue: number }> = {};
    
    (stockItems || []).forEach(item => {
        if (!stockPortfolio[item.name]) {
            stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
        }
        stockPortfolio[item.name].weight += item.weight;
        stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
    });

    (stockTransactions || []).forEach(tx => {
        if (!stockPortfolio[tx.stockItemName]) {
            stockPortfolio[tx.stockItemName] = { weight: 0, totalValue: 0 };
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
    
    let totalWeight = 0;
    let totalValue = 0;
    Object.values(stockPortfolio).forEach(item => {
        totalWeight += item.weight;
        totalValue += item.totalValue;
    });
    
    return {
      currentStockWeight: totalWeight,
      currentStockValue: totalValue
    };
  }, [stockItems, stockTransactions]);

  const totalBalance = (cashBalance ?? 0) + (bankBalance ?? 0)

  const renderValue = (value: string | number, isCurrency = true) => {
    if (isLoading) {
      return <Skeleton className="h-8 w-3/4" />;
    }
    const formattedValue = isCurrency ? formatCurrency(value as number) : `${value}`;
    return <div className="text-3xl font-bold font-mono animate-fade-in">{formattedValue}</div>;
  };

  const renderSubtext = (value: string) => {
    if (isLoading) {
      return <Skeleton className="h-4 w-2/3 mt-1" />;
    }
    return <div className="text-xs text-muted-foreground animate-fade-in">{value}</div>;
  }
  
  const StatCard = ({ title, value, subtext, icon: Icon, onClick }: { title: string, value: string | number, subtext: string, icon: React.ElementType, onClick?: () => void}) => (
      <Card onClick={onClick} className={cn(onClick && "cursor-pointer hover:bg-muted/50 transition-colors")}>
          <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
          </CardHeader>
          <CardContent>
            {renderValue(value, typeof value === 'number')}
            {renderSubtext(subtext)}
          </CardContent>
      </Card>
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Balance" value={totalBalance} subtext="Cash + Bank combined" icon={LineChart} />
        <StatCard title="Cash Balance" value={cashBalance ?? 0} subtext="In-hand currency" icon={Wallet} onClick={() => setActiveTab('cash')} />
        <StatCard title="Bank Balance" value={bankBalance ?? 0} subtext="Managed by financial institutions" icon={Landmark} onClick={() => setActiveTab('bank')} />
        <StatCard title="Stock Quantity" value={`${currentStockWeight.toFixed(2)} kg`} subtext={`Total Value: ${formatCurrency(currentStockValue)}`} icon={Boxes} onClick={() => setActiveTab('stock')} />
      </div>
    </div>
  )
}
