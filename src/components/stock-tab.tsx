
"use client"

import { useState } from "react"
import { useAppContext } from "@/app/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowUpCircle, ArrowDownCircle, Pencil } from "lucide-react"
import type { StockItem, StockTransaction } from "@/lib/types"
import { EditTransactionSheet } from "./edit-transaction-sheet"

export function StockTab() {
  const { stockItems, stockTransactions } = useAppContext()
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: StockTransaction | null}>({ isOpen: false, transaction: null});

  const handleEditClick = (tx: StockTransaction) => {
    setEditSheetState({ isOpen: true, transaction: tx });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  return (
    <>
      <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Stock Inventory</CardTitle>
              <CardDescription>An overview of your current stock levels and value.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Weight (kg)</TableHead>
                      <TableHead className="text-right">Avg. Price/kg</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockItems.length > 0 ? (
                      stockItems.map((item: StockItem) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.weight.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.purchasePricePerKg)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.weight * item.purchasePricePerKg)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No stock items yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock Transaction History</CardTitle>
              <CardDescription>Recent purchases and sales.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Price/kg</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockTransactions.length > 0 ? (
                    stockTransactions.map((tx: StockTransaction) => (
                      <TableRow key={tx.id}>
                        <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full flex items-center w-fit ${tx.type === 'purchase' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                            {tx.type === 'purchase' ? <ArrowDownCircle className="mr-1 h-3 w-3" /> : <ArrowUpCircle className="mr-1 h-3 w-3" />}
                            {tx.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{tx.stockItemName}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="text-right">{tx.weight.toFixed(2)} kg</TableCell>
                        <TableCell className="text-right">{formatCurrency(tx.pricePerKg)}</TableCell>
                        <TableCell className={`text-right font-semibold ${tx.type === 'purchase' ? 'text-destructive' : 'text-accent'}`}>{formatCurrency(tx.weight * tx.pricePerKg)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(tx)}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={8} className="text-center h-24">No stock transactions yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
      </div>
      {editSheetState.transaction && (
        <EditTransactionSheet 
          isOpen={editSheetState.isOpen}
          setIsOpen={(isOpen) => setEditSheetState({ isOpen, transaction: isOpen ? editSheetState.transaction : null })}
          transaction={editSheetState.transaction}
          transactionType="stock"
        />
      )}
    </>
  )
}
