
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Pencil, History, Trash2 } from "lucide-react"
import type { CashTransaction } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"

export function CashTab() {
  const { cashBalance, cashTransactions, transferFunds, deleteCashTransaction, deleteMultipleCashTransactions, currency } = useAppContext()
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false)
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: CashTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txId: string | null, txIds: string[] | null}>({ isOpen: false, txId: null, txIds: null });
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  const handleEditClick = (tx: CashTransaction) => {
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
        deleteCashTransaction(deleteDialogState.txId);
    }
    if (deleteDialogState.txIds && deleteDialogState.txIds.length > 0) {
        deleteMultipleCashTransactions(deleteDialogState.txIds);
        setSelectedTxIds([]);
    }
    setDeleteDialogState({ isOpen: false, txId: null, txIds: null });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount)
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

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedTxIds(cashTransactions.map(tx => tx.id));
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


  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle>Cash Ledger</CardTitle>
            <CardDescription>
              Current Balance: <span className="font-bold text-primary">{formatCurrency(cashBalance)}</span>
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {selectedTxIds.length > 0 && (
                <Button variant="destructive" onClick={handleMultiDeleteClick}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedTxIds.length})
                </Button>
            )}
            <Sheet open={isTransferSheetOpen} onOpenChange={setIsTransferSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</Button>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                    <Checkbox 
                        onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                        checked={selectedTxIds.length === cashTransactions.length && cashTransactions.length > 0}
                        aria-label="Select all rows"
                    />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashTransactions.length > 0 ? (
                cashTransactions.map((tx: CashTransaction) => (
                  <TableRow key={tx.id} data-state={selectedTxIds.includes(tx.id) && "selected"}>
                    <TableCell>
                        <Checkbox 
                            onCheckedChange={(checked) => handleSelectRow(tx.id, Boolean(checked))}
                            checked={selectedTxIds.includes(tx.id)}
                            aria-label="Select row"
                        />
                    </TableCell>
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
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell>{tx.category}</TableCell>
                    <TableCell className={`text-right font-semibold ${tx.type === 'income' ? 'text-accent' : 'text-destructive'}`}>
                      <div className="flex items-center justify-end gap-2">
                        {tx.type === 'income' ? <ArrowUpCircle /> : <ArrowDownCircle />}
                        {formatCurrency(tx.amount)}
                      </div>
                    </TableCell>
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
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">No cash transactions yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      {editSheetState.transaction && (
        <EditTransactionSheet 
          isOpen={editSheetState.isOpen}
          setIsOpen={(isOpen) => setEditSheetState({ isOpen, transaction: isOpen ? editSheetState.transaction : null })}
          transaction={editSheetState.transaction}
          transactionType="cash"
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
