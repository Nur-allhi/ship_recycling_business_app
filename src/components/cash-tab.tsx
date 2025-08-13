
"use client"

import { useState } from "react"
import { useAppContext } from "@/app/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from "lucide-react"
import type { CashTransaction } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"


export function CashTab() {
  const { cashBalance, cashTransactions, transferFunds } = useAppContext()
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const handleTransferSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const amount = parseFloat(formData.get('amount') as string)
    if (amount > 0) {
      transferFunds('cash', amount)
      setIsTransferSheetOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cash Ledger</CardTitle>
          <CardDescription>
            Current Balance: <span className="font-bold text-primary">{formatCurrency(cashBalance)}</span>
          </CardDescription>
        </div>
        <Sheet open={isTransferSheetOpen} onOpenChange={setIsTransferSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="outline"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                <SheetTitle>Transfer Funds</SheetTitle>
                <SheetDescription>Move money from cash to your bank account.</SheetDescription>
                </SheetHeader>
                <form onSubmit={handleTransferSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
                    </div>
                    <Button type="submit" className="w-full">Transfer to Bank</Button>
                </form>
            </SheetContent>
        </Sheet>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashTransactions.length > 0 ? (
              cashTransactions.slice(0, 20).map((tx: CashTransaction) => (
                <TableRow key={tx.id}>
                  <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{tx.description}</TableCell>
                  <TableCell>{tx.category}</TableCell>
                  <TableCell className={`text-right font-semibold ${tx.type === 'income' ? 'text-accent' : 'text-destructive'}`}>
                    <div className="flex items-center justify-end gap-2">
                      {tx.type === 'income' ? <ArrowUpCircle /> : <ArrowDownCircle />}
                      {formatCurrency(tx.amount)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">No cash transactions yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  )
}
