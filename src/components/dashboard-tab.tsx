"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAppContext } from "@/app/store"
import { Wallet, Landmark, Boxes, LineChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardTabProps {
  setActiveTab: (tab: string) => void;
}

export function DashboardTab({ setActiveTab }: DashboardTabProps) {
  const { cashBalance, bankBalance, stockItems, currency, isLoading } = useAppContext()

  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const totalStockValue = stockItems.reduce((acc, item) => acc + item.weight * item.purchasePricePerKg, 0)
  const totalStockWeight = stockItems.reduce((acc, item) => acc + item.weight, 0);
  const totalBalance = cashBalance + bankBalance

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
        <StatCard title="Cash Balance" value={cashBalance} subtext="In-hand currency" icon={Wallet} onClick={() => setActiveTab('cash')} />
        <StatCard title="Bank Balance" value={bankBalance} subtext="Managed by financial institutions" icon={Landmark} onClick={() => setActiveTab('bank')} />
        <StatCard title="Stock Quantity" value={`${totalStockWeight.toFixed(2)} kg`} subtext={`Total Value: ${formatCurrency(totalStockValue)}`} icon={Boxes} onClick={() => setActiveTab('stock')} />
      </div>
    </div>
  )
}
