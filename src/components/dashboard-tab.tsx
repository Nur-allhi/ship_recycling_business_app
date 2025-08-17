
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppContext } from "@/app/store"
import { Wallet, Landmark, Boxes, LineChart } from "lucide-react"

interface DashboardTabProps {
  setActiveTab: (tab: string) => void;
}

export function DashboardTab({ setActiveTab }: DashboardTabProps) {
  const { cashBalance, bankBalance, stockItems, currency, initialBalanceSet } = useAppContext()

  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `BDT ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const totalStockValue = stockItems.reduce((acc, item) => acc + item.weight * item.purchasePricePerKg, 0)
  const totalStockWeight = stockItems.reduce((acc, item) => acc + item.weight, 0);
  const totalBalance = cashBalance + bankBalance

  const renderValue = (value: string) => {
    if (!initialBalanceSet) {
      return <div className="h-8 bg-muted rounded animate-pulse w-3/4" />;
    }
    return <div className="text-2xl font-bold font-mono animate-fade-in">{value}</div>;
  };

  const renderSubtext = (value: string) => {
    if (!initialBalanceSet) {
      return <div className="h-4 bg-muted rounded animate-pulse w-2/3 mt-1" />;
    }
    return <div className="text-xs text-muted-foreground animate-fade-in">{value}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {renderValue(formatCurrency(totalBalance))}
            {renderSubtext("Cash + Bank combined")}
          </CardContent>
        </Card>
        <Card onClick={() => setActiveTab('cash')} className="cursor-pointer hover:bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {renderValue(formatCurrency(cashBalance))}
             {renderSubtext("In-hand currency")}
          </CardContent>
        </Card>
        <Card onClick={() => setActiveTab('bank')} className="cursor-pointer hover:bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {renderValue(formatCurrency(bankBalance))}
             {renderSubtext("Managed by financial institutions")}
          </CardContent>
        </Card>
        <Card onClick={() => setActiveTab('stock')} className="cursor-pointer hover:bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Quantity</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {renderValue(`${totalStockWeight.toFixed(2)} kg`)}
             {renderSubtext(`Total Value: ${formatCurrency(totalStockValue)}`)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

    