
"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useAppContext } from "@/app/context/app-context"
import { useAppActions } from "@/app/context/app-actions"
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
import { ArrowRightLeft, Pencil, History, Trash2, CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff, ArrowUpDown, Loader2, Printer } from "lucide-react"
import type { CashTransaction, MonthlySnapshot } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"
import { format, subMonths, addMonths, startOfMonth, isBefore } from "date-fns"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "./ui/badge"
import { db } from "@/lib/db"
import { motion, AnimatePresence } from "framer-motion"
import { useLiveQuery } from "dexie-react-hooks"
import { generateCashLedgerPdf } from "@/lib/pdf-utils"
import { useSortedTransactions, calculateRunningBalances } from "@/lib/db-queries"
import { toYYYYMMDD } from "@/lib/utils"

type SortKey = keyof CashTransaction | 'debit' | 'credit' | null;
type SortDirection = 'asc' | 'desc';

export function CashTab() {
  const { currency, user, banks, contacts, loans } = useAppContext()
  const allCashTransactions = useLiveQuery(() => db.cash_transactions.toArray());
  const cashBalance = useLiveQuery(() => 
    db.cash_transactions.toArray().then(txs => 
      txs.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0)
    ), []);

  const { transferFunds, deleteCashTransaction, deleteMultipleCashTransactions } = useAppActions();
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false)
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: CashTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: CashTransaction | null, txsToDelete: CashTransaction[] | null}>({ isOpen: false, transaction: null, txsToDelete: null });
  const [selectedTxs, setSelectedTxs] = useState<CashTransaction[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showActions, setShowActions] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTransferBankId, setSelectedTransferBankId] = useState<string | undefined>(banks.length > 0 ? banks[0].id : undefined);
  const [monthlySnapshot, setMonthlySnapshot] = useState<MonthlySnapshot | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(true);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  // Use centralized sorting function that implements ORDER BY date ASC, created_at ASC
  const { isLoading: isTransactionsLoading, transactions: displayTransactions, chronologicalTransactions } = useSortedTransactions('cash_transactions', {
    month: currentMonth,
    sortKey: sortKey as any, // Type assertion needed due to component-specific sort keys
    sortDirection,
  });

  const isLoading = allCashTransactions === undefined || isTransactionsLoading;

  const fetchSnapshot = useCallback(async () => {
    setIsSnapshotLoading(true);
    const localSnapshot = await db.monthly_snapshots.where('snapshot_date').equals(toYYYYMMDD(startOfMonth(currentMonth))).first();
    
    if (localSnapshot) {
        setMonthlySnapshot(localSnapshot);
    } else {
        setMonthlySnapshot(null);
    }
    setIsSnapshotLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };
  
  // Calculate running balances using chronological order to prevent negative balance issues
  const transactionsWithBalances = useMemo(() => {
    if (!chronologicalTransactions || !allCashTransactions) return [];
    
    const start = startOfMonth(currentMonth);
    let openingBalance = 0;

    if (monthlySnapshot) {
        openingBalance = monthlySnapshot.cash_balance;
    } else {
        const historicalTxs = allCashTransactions
            .filter(tx => isBefore(new Date(tx.date), start));
        
        openingBalance = historicalTxs
            .reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0);
    }
    // Use chronological order for balance calculation to maintain proper sequence
    return calculateRunningBalances(chronologicalTransactions, openingBalance);
  }, [monthlySnapshot, chronologicalTransactions, allCashTransactions, currentMonth]);

  // Map display transactions to include balances
  const sortedTransactions = useMemo(() => {
    if (!displayTransactions || !transactionsWithBalances) return [];
    
    const balanceMap = new Map(transactionsWithBalances.map(tx => [tx.id, tx.balance]));
    return displayTransactions.map(tx => ({
      ...tx,
      balance: balanceMap.get(tx.id) || 0
    }));
  }, [displayTransactions, transactionsWithBalances]);

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
    if (amount === 0) return '-';
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const handleTransferSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const amount = parseFloat(formData.get('amount') as string);
    const description = formData.get('description') as string;
    if (amount > 0 && selectedTransferBankId) {
      transferFunds('cash', amount, new Date().toISOString().split('T')[0], selectedTransferBankId, description);
      setIsTransferSheetOpen(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedTxs(sortedTransactions);
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
  }
  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  }
  
  const handlePrint = () => {
    const txForPdf = [...transactionsWithBalances].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    generateCashLedgerPdf(txForPdf, currentMonth, currency, cashBalance ?? 0);
  }

  const renderSortArrow = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortDirection === 'desc' ? '▼' : '▲';
  };

  const renderDesktopView = () => (
     <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {isSelectionMode && (
              <TableHead className="w-[50px] text-center">
                  <Checkbox 
                      onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                      checked={selectedTxs.length === sortedTransactions.length && sortedTransactions.length > 0}
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
            <TableHead className="text-right">
                 <Button variant="ghost" onClick={() => handleSort('debit')}>Debit {renderSortArrow('debit')}</Button>
            </TableHead>
            <TableHead className="text-right">
                 <Button variant="ghost" onClick={() => handleSort('credit')}>Credit {renderSortArrow('credit')}</Button>
            </TableHead>
            <TableHead className="text-right">Balance</TableHead>
            {showActions && <TableHead className="text-center">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <motion.tbody>
          <AnimatePresence initial={false}>
          {isLoading || isSnapshotLoading ? (
            <TableRow><TableCell colSpan={isSelectionMode ? 8 : 7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
          ) : sortedTransactions.length > 0 ? (
              sortedTransactions.map((tx: any) => {
                  let description = tx.description;
                  let subDescription = null;

                  if (tx.linkedLoanId) {
                      const loan = (loans || []).find(l => l.id === tx.linkedLoanId);
                      if (loan) {
                          const contact = (contacts || []).find(c => c.id === loan.contact_id);
                          description = loan.type === 'payable' ? 'Loan Received from' : 'Loan Disbursed to';
                          if (contact) {
                              description += ` ${contact.name}`;
                          }
                      }
                  } else if (tx.contact_id) {
                      const contact = (contacts || []).find(c => c.id === tx.contact_id);
                      if (contact) {
                          subDescription = `(${contact.name})`;
                      }
                  }
                  
                  return (
                <motion.tr 
                  key={tx.id} 
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  data-state={selectedTxIds.includes(tx.id) && "selected"}
                >
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
                  <TableCell className="font-medium text-left">
                    {description}
                    {subDescription && <span className="text-xs text-muted-foreground block">{subDescription}</span>}
                  </TableCell>
                  <TableCell className="text-center">{tx.category}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(tx.type === 'expense' ? tx.actual_amount : 0)}</TableCell>
                  <TableCell className="text-right font-mono text-accent">{formatCurrency(tx.type === 'income' ? tx.actual_amount : 0)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(tx.balance)}</TableCell>
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
                </motion.tr>
              )})
          ) : (
            <TableRow>
              <TableCell colSpan={isSelectionMode ? (showActions ? 8 : 7) : (showActions ? 7 : 6)} className="text-center h-24">No cash transactions found for {format(currentMonth, 'MMMM yyyy')}.</TableCell>
            </TableRow>
          )}
          </AnimatePresence>
        </motion.tbody>
      </Table>
      </div>
  );

  const renderMobileView = () => (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : sortedTransactions.length > 0 ? (
        <AnimatePresence initial={false}>
          {sortedTransactions.map((tx: any) => {
            let description = tx.description;
            let subDescription = null;

            if (tx.linkedLoanId) {
                const loan = (loans || []).find(l => l.id === tx.linkedLoanId);
                if (loan) {
                    const contact = (contacts || []).find(c => c.id === loan.contact_id);
                    description = loan.type === 'payable' ? 'Loan Received from' : 'Loan Disbursed to';
                    if (contact) {
                        description += ` ${contact.name}`;
                    }
                }
            } else if (tx.contact_id) {
                const contact = (contacts || []).find(c => c.id === tx.contact_id);
                if (contact) {
                    subDescription = `(${contact.name})`;
                }
            }

            return (
            <motion.div 
              key={tx.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
            <Card>
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
                  <div className="font-medium text-base">{description}</div>
                  {subDescription && <div className="text-sm text-muted-foreground font-semibold">{subDescription}</div>}
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
            </motion.div>
          )})}
        </AnimatePresence>
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
                View your cash-in-hand transactions. Current balance: <span className="font-bold text-primary">{isLoading ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : formatCurrency(cashBalance ?? 0)}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-center justify-center sm:self-auto">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-9 w-9">
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-28 sm:w-32 text-center">{format(currentMonth, "MMMM yyyy")}</span>
              <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                  <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-col items-center justify-center gap-2 pt-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" variant={isSelectionMode ? "secondary" : "outline"} onClick={toggleSelectionMode}>
                        <CheckSquare className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setShowActions(!showActions)} className="px-2 sm:px-3">
                             {showActions ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{showActions ? 'Hide' : 'Show'} Actions</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button size="sm" variant="outline" onClick={handlePrint} className="px-2 sm:px-3">
                               <Printer className="h-4 w-4" />
                           </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                           <p>Print this month's ledger</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Sheet open={isTransferSheetOpen} onOpenChange={setIsTransferSheetOpen}>
                        <SheetTrigger asChild>
                            <Button size="sm" variant="outline"><ArrowRightLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Transfer</span></Button>
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
                                    <ResponsiveSelect 
                                      value={selectedTransferBankId}
                                      onValueChange={setSelectedTransferBankId}
                                      title="Select a Bank Account" 
                                      items={(banks || []).map(b => ({value: b.id, label: b.name}))} 
                                    />
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
                            <Trash2 className="h-4 w-4" /> <span className="ml-2">({selectedTxs.length})</span>
                        </Button>
                    )}
                </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
           {isMobile ? renderMobileView() : renderDesktopView()}
        </CardContent>
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

    