
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAppContext } from "@/app/context/app-context"
import { Wallet, Landmark, Boxes, LineChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import type { CashTransaction, BankTransaction, StockItem, StockTransaction } from "@/lib/types";


interface DashboardTabProps {
  setActiveTab: (tab: string) => void;
  cashBalance: number;
  bankBalance: number;
}

export function DashboardTab({ 
  setActiveTab,
  cashBalance,
  bankBalance,
}: DashboardTabProps) {
  const { currency, showStockValue, currentStockValue, currentStockWeight, isLoading, cashTransactions } = useAppContext()

  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const totalBalance = cashBalance + bankBalance;
  
  // Use a more reliable loading check. If cashTransactions is undefined, it means liveQuery is not ready.
  const isComponentLoading = cashTransactions === undefined;

  const renderValue = (value: string | number, isCurrency = true) => {
    if (isComponentLoading) {
      return <Skeleton className="h-8 w-3/4" />;
    }
    const formattedValue = isCurrency ? formatCurrency(value as number) : `${value}`;
    return <div className="text-3xl font-bold font-mono animate-fade-in">{formattedValue}</div>;
  };

  const renderSubtext = (value: string) => {
    if (isComponentLoading) {
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
        <StatCard title="Cash Balance" value={cashBalance} subtext="In-hand currency" icon={Wallet} onClick={() => setActiveTab('cash')} />
        <StatCard title="Bank Balance" value={bankBalance} subtext="Managed by financial institutions" icon={Landmark} onClick={() => setActiveTab('bank')} />
        <StatCard title="Stock Quantity" value={`${currentStockWeight.toFixed(2)} kg`} subtext={showStockValue ? `Total Value: ${formatCurrency(currentStockValue)}` : 'Value is hidden'} icon={Boxes} onClick={() => setActiveTab('stock')} />
      </div>
    </div>
  )
}
