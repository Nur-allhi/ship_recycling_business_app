
"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useAppContext } from "@/app/context/app-context"
import { useAppActions } from "@/app/context/app-actions"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowRightLeft, Pencil, History, Trash2, CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff, ArrowUpDown, Loader2 } from "lucide-react"
import type { BankTransaction, MonthlySnapshot } from "@/lib/types"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isBefore } from "date-fns"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "./ui/badge"
import * as server from "@/lib/actions";
import { db } from "@/lib/db"

const toYYYYMMDD = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

type SortKey = keyof BankTransaction | 'debit' | 'credit' | null;
type SortDirection = 'asc' | 'desc';

export function BankTab() {
  const { bankBalance, bankTransactions, currency, user, banks, isLoading, handleApiError, isOnline } = useAppContext()
  const { transferFunds, deleteBankTransaction, deleteMultipleBankTransactions } = useAppActions();
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false)
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: BankTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: BankTransaction | null, txsToDelete: BankTransaction[] | null}>({ isOpen: false, txToDelete: null, txsToDelete: null });
  const [selectedTxs, setSelectedTxs] = useState<BankTransaction[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showActions, setShowActions] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedBankId, setSelectedBankId] = useState<string | 'all'>('all');
  const [selectedTransferBankId, setSelectedTransferBankId] = useState<string | undefined>(banks.length > 0 ? banks[0].id : undefined);
  const [monthlySnapshot, setMonthlySnapshot] = useState<MonthlySnapshot | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(true);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  const fetchSnapshot = useCallback(async () => {
    if (!isOnline) {
        const localSnapshot = await db.monthly_snapshots.where('snapshot_date').equals(toYYYYMMDD(startOfMonth(currentMonth))).first();
        setMonthlySnapshot(localSnapshot || null);
        setIsSnapshotLoading(false);
        return;
    }
    
    setIsSnapshotLoading(true);
    try {
        const snapshot = await server.getOrCreateSnapshot(currentMonth.toISOString());
        setMonthlySnapshot(snapshot);
        if (snapshot) {
            await db.monthly_snapshots.put(snapshot);
        }
    } catch(e) {
        handleApiError(e);
        setMonthlySnapshot(null);
    } finally {
        setIsSnapshotLoading(false);
    }
  }, [currentMonth, handleApiError, isOnline]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const filteredByBank = useMemo(() => {
    if (!bankTransactions) return [];
    if (selectedBankId === 'all') return bankTransactions;
    return bankTransactions.filter(tx => tx.bank_id === selectedBankId);
  }, [bankTransactions, selectedBankId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const filteredByMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return filteredByBank.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= start && txDate <= end;
    })
  }, [filteredByBank, currentMonth]);
  
  const transactionsWithBalances = useMemo(() => {
    const start = startOfMonth(currentMonth);
    let openingBalance = 0;

    if (monthlySnapshot) {
        if (selectedBankId === 'all') {
            openingBalance = Object.values(monthlySnapshot.bank_balances || {}).reduce((sum, b) => sum + b, 0);
        } else {
            openingBalance = monthlySnapshot.bank_balances?.[selectedBankId] || 0;
        }
    } else {
        openingBalance = (filteredByBank || [])
            .filter(tx => isBefore(new Date(tx.date), start))
            .reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0);
    }

    const txsInMonthForCalc = [...filteredByMonth].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if(dateA !== dateB) return dateA - dateB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let currentBalance = openingBalance;
    const balancesMap = new Map<string, number>();
    for (const tx of txsInMonthForCalc) {
        currentBalance += (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount);
        balancesMap.set(tx.id, currentBalance);
    }

    return filteredByMonth.map(tx => ({...tx, balance: balancesMap.get(tx.id) || 0}));
  }, [monthlySnapshot, filteredByMonth, selectedBankId, filteredByBank, currentMonth]);

  const sortedTransactions = useMemo(() => {
    return [...transactionsWithBalances].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortKey === 'debit') {
            aValue = a.type === 'withdrawal' ? a.actual_amount : 0;
            bValue = b.type === 'withdrawal' ? b.actual_amount : 0;
        } else if (sortKey === 'credit') {
            aValue = a.type === 'deposit' ? a.actual_amount : 0;
            bValue = b.type === 'deposit' ? b.actual_amount : 0;
        } else if(sortKey === 'date') {
             const dateA = new Date(a.date).getTime();
             const dateB = new Date(b.date).getTime();
             if(dateA !== dateB) return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
              // Secondary sort for date
             return sortDirection === 'desc' 
                ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() 
                : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortKey) {
            aValue = a[sortKey as keyof BankTransaction];
            bValue = b[sortKey as keyof BankTransaction];
        } else {
            return 0;
        }
        
        let result = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            result = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            result = aValue - bValue;
        }
        
        return sortDirection === 'desc' ? -result : result;
    });
  }, [transactionsWithBalances, sortKey, sortDirection]);

  const handleEditClick = (tx: BankTransaction) => {
    setEditSheetState({ isOpen: true, transaction: tx });
  }

  const handleDeleteClick = (tx: BankTransaction) => {
    setDeleteDialogState({ isOpen: true, txToDelete: tx, txsToDelete: null });
  };
  
  const handleMultiDeleteClick = () => {
    setDeleteDialogState({ isOpen: true, txToDelete: null, txsToDelete: selectedTxs });
  }

  const confirmDeletion = () => {
    if (deleteDialogState.txToDelete) {
        deleteBankTransaction(deleteDialogState.txToDelete);
    }
    if (deleteDialogState.txsToDelete && deleteDialogState.txsToDelete.length > 0) {
        deleteMultipleBankTransactions(deleteDialogState.txsToDelete);
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
      transferFunds('bank', amount, new Date().toISOString().split('T')[0], selectedTransferBankId, description);
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

  const handleSelectRow = (tx: BankTransaction, checked: boolean) => {
      if (checked) {
          setSelectedTxs(prev => [...prev, tx]);
      } else {
          setSelectedTxs(prev => prev.filter(t => t.id !== tx.id));
      }
  }

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
  
  const renderSortArrow = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortDirection === 'desc' ? '▼' : '▲';
  };
  
  const selectedTxIds = useMemo(() => selectedTxs.map(tx => tx.id), [selectedTxs]);
  
  const bankAccountItems = useMemo(() => [
      { value: 'all', label: 'All Banks'},
      ...(banks || []).map(bank => ({ value: bank.id, label: bank.name }))
  ], [banks]);
  
  const displayBalance = useMemo(() => {
    if (selectedBankId === 'all') {
      return bankBalance;
    }
    return bankTransactions
        .filter(tx => tx.bank_id === selectedBankId)
        .reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0);
  }, [bankBalance, bankTransactions, selectedBankId]);

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
            {selectedBankId === 'all' && (
                <TableHead className="text-center">
                    <Button variant="ghost" onClick={() => handleSort('bank_id')}>Bank {renderSortArrow('bank_id')}</Button>
                </TableHead>
            )}
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
        <TableBody>
            {isLoading || isSnapshotLoading ? (
              <TableRow><TableCell colSpan={isSelectionMode ? 9 : 8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : sortedTransactions.length > 0 ? (
            sortedTransactions.map((tx: any) => (
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
                {selectedBankId === 'all' && (
                    <TableCell className="text-center">
                        {(banks || []).find(b => b.id === tx.bank_id)?.name || 'N/A'}
                    </TableCell>
                )}
                <TableCell className="text-right font-mono text-destructive">{formatCurrency(tx.type === 'withdrawal' ? tx.actual_amount : 0)}</TableCell>
                <TableCell className="text-right font-mono text-accent">{formatCurrency(tx.type === 'deposit' ? tx.actual_amount : 0)}</TableCell>
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
                </TableRow>
            ))
            ) : (
            <TableRow>
                <TableCell colSpan={isSelectionMode ? (showActions ? 10 : 9) : (showActions ? 9 : 8)} className="text-center h-24">No bank transactions found for {format(currentMonth, 'MMMM yyyy')}.</TableCell>
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
      ) : sortedTransactions.length > 0 ? (
        sortedTransactions.map((tx: BankTransaction) => (
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
                    <div className={`font-semibold text-lg font-mono ${tx.type === 'deposit' ? 'text-accent' : 'text-destructive'}`}>
                        {formatCurrency(tx.actual_amount)}
                    </div>
                     <Badge variant={tx.type === 'deposit' ? 'default' : 'destructive'} className="capitalize bg-opacity-20 text-opacity-100">
                        {tx.type}
                    </Badge>
                </div>
                <div className="font-medium text-base">{tx.description}</div>
                <div className="text-sm text-muted-foreground">{tx.category}</div>
                 {selectedBankId === 'all' && (
                    <div className="text-sm text-muted-foreground font-semibold">
                        {(banks || []).find(b => b.id === tx.bank_id)?.name || 'N/A'}
                    </div>
                )}
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
            No bank transactions found for {format(currentMonth, 'MMMM yyyy')}.
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
                    <CardTitle>Bank Ledger</CardTitle>
                    <CardDescription>
                        View your bank account transactions. Current balance: <span className="font-bold text-primary">{formatCurrency(displayBalance)}</span>
                    </CardDescription>
                </div>
                <div className="flex items-center flex-wrap gap-2 justify-center self-stretch sm:self-center">
                    <ResponsiveSelect
                        value={selectedBankId}
                        onValueChange={(value) => setSelectedBankId(value)}
                        title="Select a Bank Account"
                        placeholder="All Banks"
                        className="min-w-[150px]"
                        items={bankAccountItems}
                    />
                    <div className="flex items-center gap-2 self-center justify-center sm:self-auto">
                        <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-9 w-9">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium w-28 text-center">{format(currentMonth, "MMMM yyyy")}</span>
                        <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
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
                            <SheetDescription>Move money from your bank account to cash.</SheetDescription>
                            </SheetHeader>
                            <form onSubmit={handleTransferSubmit} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount</Label>
                                    <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_id">From Bank Account</Label>
                                    <ResponsiveSelect
                                      value={selectedTransferBankId}
                                      onValueChange={setSelectedTransferBankId}
                                      title="Select a Bank Account"
                                      items={(banks || []).map(b => ({value: b.id, label: b.name}))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Input id="description" name="description" placeholder="e.g., Cash for expenses" />
                                </div>
                                <Button type="submit" className="w-full">Transfer to Cash</Button>
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
      </Card>
      {isAdmin && editSheetState.transaction && (
        <EditTransactionSheet 
          isOpen={editSheetState.isOpen}
          setIsOpen={(isOpen) => setEditSheetState({ isOpen, transaction: isOpen ? editSheetState.transaction : null })}
          transaction={editSheetState.transaction}
          transactionType="bank"
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
