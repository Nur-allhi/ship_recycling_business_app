
"use client"

import { useState, useMemo } from "react"
import { useAppContext } from "@/app/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Pencil, History, Trash2, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react"
import type { CashTransaction } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"
import { format, subMonths, addMonths } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "./ui/badge"

export function CashTab() {
  const { cashBalance, cashTransactions, transferFunds, deleteCashTransaction, deleteMultipleCashTransactions, currency } = useAppContext()
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false)
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: CashTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txId: string | null, txIds: string[] | null}>({ isOpen: false, txId: null, txIds: null });
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const isMobile = useIsMobile();

  const filteredByMonth = useMemo(() => {
    return cashTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === currentMonth.getFullYear() && txDate.getMonth() === currentMonth.getMonth();
    })
  }, [cashTransactions, currentMonth]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredByMonth.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredByMonth, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredByMonth.length / itemsPerPage);

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
    setIsSelectionMode(false);
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
          setSelectedTxIds(paginatedTransactions.map(tx => tx.id));
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
    setSelectedTxIds([]);
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setCurrentPage(1);
  }
  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setCurrentPage(1);
  }

  const renderDesktopView = () => (
     <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {isSelectionMode && (
              <TableHead className="w-[50px]">
                  <Checkbox 
                      onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                      checked={selectedTxIds.length === paginatedTransactions.length && paginatedTransactions.length > 0}
                      aria-label="Select all rows"
                  />
              </TableHead>
            )}
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((tx: CashTransaction) => (
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
              <TableCell colSpan={isSelectionMode ? 6 : 5} className="text-center h-24">No cash transactions for {format(currentMonth, "MMMM yyyy")}.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
  );

  const renderMobileView = () => (
    <div className="space-y-4">
      {paginatedTransactions.length > 0 ? (
        paginatedTransactions.map((tx: CashTransaction) => (
          <Card key={tx.id} className="relative">
             {isSelectionMode && (
                <Checkbox 
                    onCheckedChange={(checked) => handleSelectRow(tx.id, Boolean(checked))}
                    checked={selectedTxIds.includes(tx.id)}
                    aria-label="Select row"
                    className="absolute top-4 left-4"
                />
              )}
            <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                    <div className={`font-semibold text-lg ${tx.type === 'income' ? 'text-accent' : 'text-destructive'}`}>
                        {formatCurrency(tx.amount)}
                    </div>
                    <Badge variant={tx.type === 'income' ? 'default' : 'destructive'} className="capitalize bg-opacity-20 text-opacity-100">
                        {tx.type}
                    </Badge>
                </div>
                <div className="font-medium text-base">{tx.description}</div>
                <div className="text-sm text-muted-foreground">{tx.category}</div>

                <div className="flex justify-between items-center pt-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {new Date(tx.date).toLocaleDateString()}
                        {tx.lastEdited && (
                           <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <History className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edited on: {new Date(tx.lastEdited).toLocaleString()}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                    </div>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(tx)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(tx.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="text-center text-muted-foreground py-12">
            No cash transactions for {format(currentMonth, "MMMM yyyy")}.
        </div>
      )}
    </div>
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex-1">
              <CardTitle>Cash Ledger</CardTitle>
              <CardDescription>
                Current Balance: <span className="font-bold text-primary">{formatCurrency(cashBalance)}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-9 w-9">
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-28 sm:w-32 text-center">{format(currentMonth, "MMMM yyyy")}</span>
              <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                  <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 pt-4">
              {selectedTxIds.length > 0 && (
                  <Button size="sm" variant="destructive" onClick={handleMultiDeleteClick} className="w-full sm:w-auto">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedTxIds.length})
                  </Button>
              )}
              <Button size="sm" variant={isSelectionMode ? "secondary" : "outline"} onClick={toggleSelectionMode} className="w-full sm:w-auto">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {isSelectionMode ? 'Cancel' : 'Select'}
              </Button>
              <Sheet open={isTransferSheetOpen} onOpenChange={setIsTransferSheetOpen}>
                  <SheetTrigger asChild>
                      <Button size="sm" variant="outline" className="w-full sm:w-auto"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</Button>
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
           {isMobile ? renderMobileView() : renderDesktopView()}
        </CardContent>
        {filteredByMonth.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Showing page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
               <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Records per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="30">30 / page</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage === totalPages}>
                Next
              </Button>
            </div>
          </CardFooter>
        )}
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
