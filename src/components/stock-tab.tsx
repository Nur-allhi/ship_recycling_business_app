
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
  TableFooter,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUpCircle, ArrowDownCircle, Pencil, History, Trash2, CheckSquare } from "lucide-react"
import type { StockItem, StockTransaction } from "@/lib/types"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"

export function StockTab() {
  const { stockItems, stockTransactions, deleteStockTransaction, deleteMultipleStockTransactions, currency } = useAppContext()
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: StockTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txId: string | null, txIds: string[] | null}>({ isOpen: false, txId: null, txIds: null });
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const handleEditClick = (tx: StockTransaction) => {
    setEditSheetState({ isOpen: true, transaction: tx });
  }

  const handleDeleteClick = (txId: string) => {
    setDeleteDialogState({ isOpen: true, txId, txIds: null });
  };
  
  const handleMultiDeleteClick = () => {
    setDeleteDialogState({ isOpen: true, txId: null, txIds: selectedTxIds });
  }

  const confirmDeletion = () => {
    if (deleteDialogState.txId) {
        deleteStockTransaction(deleteDialogState.txId);
    }
     if (deleteDialogState.txIds && deleteDialogState.txIds.length > 0) {
        deleteMultipleStockTransactions(deleteDialogState.txIds);
        setSelectedTxIds([]);
    }
    setDeleteDialogState({ isOpen: false, txId: null, txIds: null });
    setIsSelectionMode(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount)
  }

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedTxIds(stockTransactions.map(tx => tx.id));
      } else {
          setSelectedTxIds([]);
      }
  }

  const handleSelectRow = (txId: string, checked: boolean) => {
      if (checked) {
          setSelectedTxIds(prev => [...prev, txId]);
      } else {
          setSelectedTxIds(prev => prev.filter(id => id !== txId));
      }
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedTxIds([]);
    }
  }

  const totalStockValue = stockItems.reduce((acc, item) => acc + (item.weight * item.purchasePricePerKg), 0);

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
                   {stockItems.length > 0 && (
                     <TableFooter>
                        <TableRow>
                          <TableCell colSpan={3} className="text-right font-bold">Total Stock Value</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(totalStockValue)}</TableCell>
                        </TableRow>
                      </TableFooter>
                   )}
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Stock Transaction History</CardTitle>
                    <CardDescription>Recent purchases and sales.</CardDescription>
                </div>
                <div className="flex gap-2">
                    {selectedTxIds.length > 0 && (
                        <Button variant="destructive" onClick={handleMultiDeleteClick}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedTxIds.length})
                        </Button>
                    )}
                    <Button variant="outline" onClick={toggleSelectionMode}>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        {isSelectionMode ? 'Cancel' : 'Select'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSelectionMode && (
                        <TableHead className="w-[50px]">
                            <Checkbox 
                                onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                                checked={selectedTxIds.length === stockTransactions.length && stockTransactions.length > 0}
                                aria-label="Select all rows"
                            />
                        </TableHead>
                    )}
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
                      <TableRow key={tx.id} data-state={selectedTxIds.includes(tx.id) && "selected"}>
                        {isSelectionMode && (
                            <TableCell>
                                <Checkbox 
                                    onCheckedChange={(checked) => handleSelectRow(tx.id, Boolean(checked))}
                                    checked={selectedTxIds.includes(tx.id)}
                                    aria-label="Select row"
                                />
                            </TableCell>
                        )}
                        <TableCell>
                           <div className="flex items-center gap-2">
                            <span>{new Date(tx.date).toLocaleDateString()}</span>
                            {tx.lastEdited && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <History className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edited on: {new Date(tx.lastEdited).toLocaleString()}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
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
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(tx)}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                            </Button>
                             <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(tx.id)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={isSelectionMode ? 9 : 8} className="text-center h-24">No stock transactions yet.</TableCell></TableRow>
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
      <DeleteConfirmationDialog 
        isOpen={deleteDialogState.isOpen}
        setIsOpen={(isOpen) => setDeleteDialogState({ isOpen, txId: null, txIds: null })}
        onConfirm={confirmDeletion}
        itemCount={deleteDialogState.txIds?.length || 1}
      />
    </>
  )
}
