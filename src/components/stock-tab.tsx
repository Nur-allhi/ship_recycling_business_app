"use client"

import { useState } from "react"
import { useAppContext } from "@/app/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { ShoppingCart, Tag, PlusCircle } from "lucide-react"
import type { StockItem, StockTransaction } from "@/lib/types"

export function StockTab() {
  const { stockItems, stockTransactions, addStockTransaction } = useAppContext()
  const [isPurchaseSheetOpen, setIsPurchaseSheetOpen] = useState(false)
  const [isSaleSheetOpen, setIsSaleSheetOpen] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const handlePurchaseSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const data = Object.fromEntries(formData.entries())
    addStockTransaction({
      type: 'purchase',
      stockItemName: data.itemName as string,
      weight: parseFloat(data.weight as string),
      pricePerKg: parseFloat(data.pricePerKg as string),
      paymentMethod: data.paymentMethod as 'cash' | 'bank',
    })
    setIsPurchaseSheetOpen(false)
  }

  const handleSaleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const data = Object.fromEntries(formData.entries())
    addStockTransaction({
      type: 'sale',
      stockItemName: data.itemName as string,
      weight: parseFloat(data.weight as string),
      pricePerKg: parseFloat(data.pricePerKg as string),
      paymentMethod: data.paymentMethod as 'cash' | 'bank',
    })
    setIsSaleSheetOpen(false)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Stock Inventory</CardTitle>
            <CardDescription>An overview of your current stock levels and value.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Weight (kg)</TableHead>
                  <TableHead>Avg. Purchase Price/kg</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockItems.length > 0 ? (
                  stockItems.map((item: StockItem) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.weight.toFixed(2)}</TableCell>
                      <TableCell>{formatCurrency(item.purchasePricePerKg)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.weight * item.purchasePricePerKg)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">No stock items yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Stock Transaction History</CardTitle>
             <CardDescription>Recent purchases and sales.</CardDescription>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Price/kg</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockTransactions.length > 0 ? (
                  stockTransactions.slice(0, 10).map((tx: StockTransaction) => (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                      <TableCell><span className={`capitalize px-2 py-1 text-xs rounded-full ${tx.type === 'purchase' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{tx.type}</span></TableCell>
                      <TableCell>{tx.stockItemName}</TableCell>
                      <TableCell>{tx.weight.toFixed(2)} kg</TableCell>
                      <TableCell>{formatCurrency(tx.pricePerKg)}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.type === 'purchase' ? 'text-destructive' : 'text-accent'}`}>{formatCurrency(tx.weight * tx.pricePerKg)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center">No stock transactions yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <Sheet open={isPurchaseSheetOpen} onOpenChange={setIsPurchaseSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full"><ShoppingCart className="mr-2 h-4 w-4" />Purchase Stock</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Purchase Stock</SheetTitle>
              <SheetDescription>Add new stock to your inventory.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handlePurchaseSubmit} className="space-y-4 mt-4">
                <div className="space-y-2"><Label htmlFor="itemName">Item Name</Label><Input id="itemName" name="itemName" required /></div>
                <div className="space-y-2"><Label htmlFor="weight">Weight (kg)</Label><Input id="weight" name="weight" type="number" step="0.01" required /></div>
                <div className="space-y-2"><Label htmlFor="pricePerKg">Price per kg</Label><Input id="pricePerKg" name="pricePerKg" type="number" step="0.01" required /></div>
                <div className="space-y-2"><Label>Payment Method</Label><RadioGroup name="paymentMethod" defaultValue="cash" className="grid grid-cols-2 gap-4">
                    <Label htmlFor="cash-purchase" className="border p-2 rounded-md text-center cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">Cash <RadioGroupItem value="cash" id="cash-purchase" className="sr-only" /></Label>
                    <Label htmlFor="bank-purchase" className="border p-2 rounded-md text-center cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">Bank <RadioGroupItem value="bank" id="bank-purchase" className="sr-only" /></Label>
                </RadioGroup></div>
                <Button type="submit" className="w-full">Add Purchase</Button>
            </form>
          </SheetContent>
        </Sheet>
        <Sheet open={isSaleSheetOpen} onOpenChange={setIsSaleSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full"><Tag className="mr-2 h-4 w-4" />Sell Stock</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sell Stock</SheetTitle>
              <SheetDescription>Record a sale from your inventory.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSaleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2"><Label htmlFor="itemNameSale">Item Name</Label><Select name="itemName" required>
                    <SelectTrigger id="itemNameSale"><SelectValue placeholder="Select an item to sell" /></SelectTrigger>
                    <SelectContent>{stockItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name} ({item.weight.toFixed(2)} kg available)</SelectItem>)}</SelectContent>
                </Select></div>
                <div className="space-y-2"><Label htmlFor="weightSale">Weight (kg)</Label><Input id="weightSale" name="weight" type="number" step="0.01" required /></div>
                <div className="space-y-2"><Label htmlFor="pricePerKgSale">Price per kg</Label><Input id="pricePerKgSale" name="pricePerKg" type="number" step="0.01" required /></div>
                <div className="space-y-2"><Label>Payment Received To</Label><RadioGroup name="paymentMethod" defaultValue="cash" className="grid grid-cols-2 gap-4">
                    <Label htmlFor="cash-sale" className="border p-2 rounded-md text-center cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">Cash <RadioGroupItem value="cash" id="cash-sale" className="sr-only" /></Label>
                    <Label htmlFor="bank-sale" className="border p-2 rounded-md text-center cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">Bank <RadioGroupItem value="bank" id="bank-sale" className="sr-only" /></Label>
                </RadioGroup></div>
                <Button type="submit" className="w-full">Record Sale</Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
