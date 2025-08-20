
"use client"

import { useState, useMemo, useEffect } from "react"
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
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Pencil, History, Trash2, CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff, ArrowUpDown, Loader2 } from "lucide-react"
import type { CashTransaction } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"
import { format, subMonths, addMonths } from "date-fns"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "./ui/badge"

type SortKey = keyof CashTransaction | null;
type SortDirection = 'asc' | 'desc';

export function CashTab() {
  const { cashTransactions, transferFunds, deleteCashTransaction, deleteMultipleCashTransactions, currency, user, banks, isLoading } = useAppContext()
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false)
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: CashTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: CashTransaction | null, txsToDelete: CashTransaction[] | null}>({ isOpen: false, txToDelete: null, txsToDelete: null });
  const [selectedTxs, setSelectedTxs] = useState<CashTransaction[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showActions, setShowActions] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedTransactions = useMemo(() => {
    if (!sortKey || !cashTransactions) return cashTransactions || [];

    return [...cashTransactions].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      let result = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        result = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        result = aValue - bValue;
      } else if (sortKey === 'date') {
        result = new Date(a.date).getTime() - new Date(b.date).getTime();
      }

      return sortDirection === 'asc' ? result : -result;
    });
  }, [cashTransactions, sortKey, sortDirection]);

  const filteredByMonth = useMemo(() => {
    return sortedTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === currentMonth.getFullYear() && txDate.getMonth() === currentMonth.getMonth();
    })
  }, [sortedTransactions, currentMonth]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredByMonth.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredByMonth, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredByMonth.length / itemsPerPage);

  const runningBalances = useMemo(() => {
    const balances: { [key: string]: number } = {};
    let balance = 0;
    // Calculate balances in reverse order (from newest to oldest) to get the correct running balance
    [...filteredByMonth].reverse().forEach(tx => {
        balances[tx.id] = balance + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount);
        balance = balances[tx.id];
    });
    return balances;
  }, [filteredByMonth]);

  const handleEditClick = (tx: CashTransaction) => {
    setEditSheetState({ isOpen: true, transaction: tx });
  }

  const handleDeleteClick = (tx: CashTransaction) => {
    setDeleteDialogState({ isOpen: true, txToDelete: tx, txsToDelete: null });
  };

  const handleMultiDeleteClick = () => {
    setDeleteDialogState({ isOpen: true, txToDelete: null, txsToDelete: selectedTxs });
  }

  const confirmDeletion = () => {
    if (deleteDialogState.txToDelete) {
        deleteCashTransaction(deleteDialogState.txToDelete);
    }
    if (deleteDialogState.txsToDelete && deleteDialogState.txsToDelete.length > 0) {
        deleteMultipleCashTransactions(deleteDialogState.txsToDelete);
        setSelectedTxs([]);
    }
    setDeleteDialogState({ isOpen: false, txToDelete: null, txsToDelete: null });
    setIsSelectionMode(false);
  };

  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const handleTransferSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const amount = parseFloat(formData.get('amount') as string);
    const bankId = formData.get('bank_id') as string;
    const description = formData.get('description') as string;
    if (amount > 0 && bankId) {
      transferFunds('cash', amount, new Date().toISOString(), bankId, description);
      setIsTransferSheetOpen(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedTxs(paginatedTransactions);
      } else {
          setSelectedTxs([]);
      }
  }

  const handleSelectRow = (tx: CashTransaction, checked: boolean) => {
      if (checked) {
          setSelectedTxs(prev => [...prev, tx]);
      } else {
          setSelectedTxs(prev => prev.filter(t => t.id !== tx.id));
      }
  }
  
  const selectedTxIds = useMemo(() => selectedTxs.map(tx => tx.id), [selectedTxs]);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedTxs([]);
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setCurrentPage(1);
  }
  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setCurrentPage(1);
  }

  const renderSortArrow = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortDirection === 'desc' ? <ArrowDownCircle className="ml-2 h-4 w-4" /> : <ArrowUpCircle className="ml-2 h-4 w-4" />;
  };

  const itemsPerPageItems = useMemo(() => [
    { value: '10', label: '10 / page' },
    { value: '20', label: '20 / page' },
    { value: '30', label: '30 / page' },
  ], []);

  const renderDesktopView = () => (
     <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {isSelectionMode && (
              <TableHead className="w-[50px] text-center">
                  <Checkbox 
                      onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                      checked={selectedTxs.length === paginatedTransactions.length && paginatedTransactions.length > 0}
                      aria-label="Select all rows"
                  />
              </TableHead>
            )}
             <TableHead className="text-center">
                <Button variant="ghost" onClick={() => handleSort('date')}>Date {renderSortArrow('date')}</Button>
            </TableHead>
            <TableHead>
                <Button variant="ghost" onClick={() => handleSort('description')}>Description {renderSortArrow('description')}</Button>
            </TableHead>
            <TableHead className="text-center">
                <Button variant="ghost" onClick={() => handleSort('category')}>Category {renderSortArrow('category')}</Button>
            </TableHead>
            <TableHead className="text-center">
                 <Button variant="ghost" onClick={() => handleSort('actual_amount')}>Amount {renderSortArrow('actual_amount')}</Button>
            </TableHead>
            <TableHead className="text-center">Balance</TableHead>
            {showActions && <TableHead className="text-center">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={isSelectionMode ? 7 : 6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
          ) : paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((tx: CashTransaction) => (
              <TableRow key={tx.id} data-state={selectedTxIds.includes(tx.id) && "selected"}>
                {isSelectionMode && (
                  <TableCell className="text-center">
                      <Checkbox 
                          onCheckedChange={(checked) => handleSelectRow(tx, Boolean(checked))}
                          checked={selectedTxIds.includes(tx.id)}
                          aria-label="Select row"
                      />
                  </TableCell>
                )}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono">{format(new Date(tx.date), 'dd-MM-yyyy')}</span>
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
                <TableCell className="font-medium text-left">{tx.description}</TableCell>
                <TableCell className="text-center">{tx.category}</TableCell>
                <TableCell className={`text-center font-semibold font-mono ${tx.type === 'income' ? 'text-accent' : 'text-destructive'}`}>
                  <div className="flex items-center justify-center gap-2">
                    {tx.type === 'income' ? <ArrowUpCircle /> : <ArrowDownCircle />}
                    {formatCurrency(tx.actual_amount)}
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono">{formatCurrency(runningBalances[tx.id] || 0)}</TableCell>
                {showActions && (
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(tx)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(tx)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={isSelectionMode ? (showActions ? 7 : 6) : (showActions ? 6 : 5)} className="text-center h-24">No cash transactions found for {format(currentMonth, 'MMMM yyyy')}.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
  );

  const renderMobileView = () => (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : paginatedTransactions.length > 0 ? (
        paginatedTransactions.map((tx: CashTransaction) => (
          <Card key={tx.id} className="relative animate-fade-in">
             {isSelectionMode && (
                <Checkbox 
                    onCheckedChange={(checked) => handleSelectRow(tx, Boolean(checked))}
                    checked={selectedTxIds.includes(tx.id)}
                    aria-label="Select row"
                    className="absolute top-4 left-4"
                />
              )}
            <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                    <div className={`font-semibold text-lg font-mono ${tx.type === 'income' ? 'text-accent' : 'text-destructive'}`}>
                        {formatCurrency(tx.actual_amount)}
                    </div>
                    <Badge variant={tx.type === 'income' ? 'default' : 'destructive'} className="capitalize bg-opacity-20 text-opacity-100">
                        {tx.type}
                    </Badge>
                </div>
                <div className="font-medium text-base">{tx.description}</div>
                <div className="text-sm text-muted-foreground">{tx.category}</div>

                <div className="flex justify-between items-center pt-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                        {format(new Date(tx.date), 'dd-MM-yyyy')}
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
                    {showActions && (
                      <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(tx)}>
                              <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(tx)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                    )}
                </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="text-center text-muted-foreground py-12">
            No cash transactions found for {format(currentMonth, 'MMMM yyyy')}.
        </div>
      )}
    </div>
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Cash Ledger</CardTitle>
              <CardDescription>
                View your cash-in-hand transactions.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-center sm:self-auto">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-9 w-9">
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-28 sm:w-32 text-center">{format(currentMonth, "MMMM yyyy")}</span>
              <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                  <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isAdmin && <div className="flex flex-col items-center justify-center gap-2 pt-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" variant={isSelectionMode ? "secondary" : "outline"} onClick={toggleSelectionMode}>
                      <CheckSquare className="mr-2 h-4 w-4" />
                      {isSelectionMode ? 'Cancel' : 'Select'}
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setShowActions(!showActions)}>
                           {showActions ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{showActions ? 'Hide' : 'Show'} Actions</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Sheet open={isTransferSheetOpen} onOpenChange={setIsTransferSheetOpen}>
                      <SheetTrigger asChild>
                          <Button size="sm" variant="outline"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</Button>
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
                              <div className="space-y-2">
                                  <Label htmlFor="bank_id">To Bank Account</Label>
                                  <ResponsiveSelect name="bank_id" title="Select a Bank Account" required items={(banks || []).map(b => ({value: b.id, label: b.name}))} />
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="description">Description (Optional)</Label>
                                  <Input id="description" name="description" placeholder="e.g., Weekly deposit" />
                              </div>
                              <Button type="submit" className="w-full">Transfer to Bank</Button>
                          </form>
                      </SheetContent>
                  </Sheet>
                  {selectedTxs.length > 0 && (
                      <Button size="sm" variant="destructive" onClick={handleMultiDeleteClick}>
                          <Trash2 className="mr-2 h-4 w-4" /> ({selectedTxs.length})
                      </Button>
                  )}
              </div>
          </div>}
        </CardHeader>
        <CardContent>
           {isMobile ? renderMobileView() : renderDesktopView()}
        </CardContent>
        {totalPages > 1 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Showing page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
               <ResponsiveSelect 
                value={String(itemsPerPage)} 
                onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
                title="Records per page"
                items={itemsPerPageItems}
               />
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
      {isAdmin && editSheetState.transaction && (
        <EditTransactionSheet 
          isOpen={editSheetState.isOpen}
          setIsOpen={(isOpen) => setEditSheetState({ isOpen, transaction: isOpen ? editSheetState.transaction : null })}
          transaction={editSheetState.transaction}
          transactionType="cash"
        />
      )}
      <DeleteConfirmationDialog 
        isOpen={deleteDialogState.isOpen}
        setIsOpen={(isOpen) => setDeleteDialogState({ isOpen, txToDelete: null, txsToDelete: null })}
        onConfirm={confirmDeletion}
        itemCount={deleteDialogState.txsToDelete?.length || (deleteDialogState.txToDelete ? 1 : 0)}
      />
    </>
  )
}
