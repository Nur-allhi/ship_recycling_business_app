"use client"

import { useState } from "react"
import { useAppContext } from "@/app/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from "lucide-react"
import type { BankTransaction } from "@/lib/types"

export function BankTab() {
  const { bankBalance, bankTransactions, addBankTransaction, bankCategories, transferFunds } = useAppContext()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const handleTransactionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const data = Object.fromEntries(formData.entries())

    const newTx = {
      type: data.type as 'deposit' | 'withdrawal',
      amount: parseFloat(data.amount as string),
      description: data.description as string,
      category: data.category as string,
    }

    if (newTx.amount > 0 && newTx.description && newTx.category) {
      addBankTransaction(newTx)
      setIsSheetOpen(false)
    }
  }

    const handleTransferSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const amount = parseFloat(formData.get('amount') as string)
    if (amount > 0) {
      transferFunds('bank', amount)
      setIsTransferSheetOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
         <div>
          <CardTitle>Bank Ledger</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Current Balance: <span className="font-bold text-primary">{formatCurrency(bankBalance)}</span>
          </p>
        </div>
        <div className="flex gap-2">
             <Sheet open={isTransferSheetOpen} onOpenChange={setIsTransferSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                    <SheetTitle>Transfer Funds</SheetTitle>
                    <SheetDescription>Move money from your bank account to cash.</SheetDescription>
                    </SheetHeader>
                    <form onSubmit={handleTransferSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
                        </div>
                        <Button type="submit" className="w-full">Transfer to Cash</Button>
                    </form>
                </SheetContent>
            </Sheet>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" />Add Transaction</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Bank Transaction</SheetTitle>
                  <SheetDescription>Record a new deposit or withdrawal.</SheetDescription>
                </SheetHeader>
                <form onSubmit={handleTransactionSubmit} className="space-y-4 mt-4">
                  <RadioGroup name="type" defaultValue="withdrawal" className="grid grid-cols-2 gap-4">
                    <div>
                      <RadioGroupItem value="deposit" id="deposit" className="peer sr-only" />
                      <Label htmlFor="deposit" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        Deposit
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="withdrawal" id="withdrawal" className="peer sr-only" />
                      <Label htmlFor="withdrawal" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        Withdrawal
                      </Label>
                    </div>
                  </RadioGroup>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" placeholder="e.g., ATM withdrawal" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                     <Select name="category" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Save Transaction</Button>
                </form>
              </SheetContent>
            </Sheet>
        </div>
      </CardHeader>
      <CardContent>
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
             {bankTransactions.length > 0 ? (
              bankTransactions.slice(0, 10).map((tx: BankTransaction) => (
                <TableRow key={tx.id}>
                  <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{tx.description}</TableCell>
                  <TableCell>{tx.category}</TableCell>
                  <TableCell className={`text-right font-semibold ${tx.type === 'deposit' ? 'text-accent' : 'text-destructive'}`}>
                    <div className="flex items-center justify-end">
                      {tx.type === 'deposit' ? <ArrowUpCircle className="mr-2 h-4 w-4" /> : <ArrowDownCircle className="mr-2 h-4 w-4" />}
                      {formatCurrency(tx.amount)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No bank transactions yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
