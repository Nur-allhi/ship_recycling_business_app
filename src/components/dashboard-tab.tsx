"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppContext } from "@/app/store"
import { Wallet, Landmark, Boxes, BarChart2 } from "lucide-react"
import { UnifiedTransactionForm } from "./unified-transaction-form"

interface DashboardTabProps {
  setActiveTab: (tab: string) => void;
}

export function DashboardTab({ setActiveTab }: DashboardTabProps) {
  const { cashBalance, bankBalance, stockItems } = useAppContext()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const totalStockValue = stockItems.reduce((acc, item) => acc + item.weight * item.purchasePricePerKg, 0)
  const totalStockWeight = stockItems.reduce((acc, item) => acc + item.weight, 0);
  const totalBalance = cashBalance + bankBalance

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground">Cash + Bank combined</p>
          </CardContent>
        </Card>
        <Card onClick={() => setActiveTab('cash')} className="cursor-pointer hover:bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cashBalance)}</div>
            <p className="text-xs text-muted-foreground">In-hand currency</p>
          </CardContent>
        </Card>
        <Card onClick={() => setActiveTab('bank')} className="cursor-pointer hover:bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(bankBalance)}</div>
            <p className="text-xs text-muted-foreground">Managed by financial institutions</p>
          </CardContent>
        </Card>
        <Card onClick={() => setActiveTab('stock')} className="cursor-pointer hover:bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStockValue)}</div>
            <p className="text-xs text-muted-foreground">
              {totalStockWeight.toFixed(2)} kg of items
            </p>
          </CardContent>
        </Card>
      </div>
      <UnifiedTransactionForm />
    </div>
  )
}
