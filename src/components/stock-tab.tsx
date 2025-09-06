
"use client"

import { useState, useMemo, useEffect } from "react"
import { useAppContext } from "@/app/context/app-context"
import { useAppActions } from "@/app/context/app-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter as TableFoot,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUpCircle, ArrowDownCircle, Pencil, History, Trash2, CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff, ArrowUpDown, Loader2, DollarSign } from "lucide-react"
import type { StockItem, StockTransaction } from "@/lib/types"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"
import { format, subMonths, addMonths } from "date-fns"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "./ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, AnimatePresence } from "framer-motion"

type SortKey = keyof StockTransaction | 'totalValue' | null;
type SortDirection = 'asc' | 'desc';


export function StockTab() {
  const { stockItems, stockTransactions, currency, showStockValue, user, loadedMonths } = useAppContext()
  const { deleteStockTransaction, deleteMultipleStockTransactions, setShowStockValue } = useAppActions();
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: StockTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txToDelete: StockTransaction | null, txsToDelete: StockTransaction[] | null}>({ isOpen: false, txToDelete: null, txsToDelete: null });
  const [selectedTxs, setSelectedTxs] = useState<StockTransaction[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showActions, setShowActions] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  const monthKey = format(currentMonth, 'yyyy-MM');
  useEffect(() => {
    const fetchMonthData = async () => {
      if (!loadedMonths[monthKey]) {
        setIsMonthLoading(true);
        // Month data loading logic would go here
        setIsMonthLoading(false);
      }
    };
    fetchMonthData();
  }, [currentMonth, loadedMonths, monthKey]);
  
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedTransactions = useMemo(() => {
    if (!sortKey || !stockTransactions) return stockTransactions || [];

    return [...stockTransactions].sort((a, b) => {
      const aValue = sortKey === 'totalValue' ? a.weight * a.pricePerKg : a[sortKey as keyof StockTransaction];
      const bValue = sortKey === 'totalValue' ? b.weight * b.pricePerKg : b[sortKey as keyof StockTransaction];
      
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
  }, [stockTransactions, sortKey, sortDirection]);

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

  const handleEditClick = (tx: StockTransaction) => {
    setEditSheetState({ isOpen: true, transaction: tx });
  }

  const handleDeleteClick = (tx: StockTransaction) => {
    setDeleteDialogState({ isOpen: true, txToDelete: tx, txsToDelete: null });
  };
  
  const handleMultiDeleteClick = () => {
    setDeleteDialogState({ isOpen: true, txToDelete: null, txsToDelete: selectedTxs });
  }

  const confirmDeletion = () => {
    if (deleteDialogState.txToDelete) {
        deleteStockTransaction(deleteDialogState.txToDelete);
    }
     if (deleteDialogState.txsToDelete && deleteDialogState.txsToDelete.length > 0) {
        deleteMultipleStockTransactions(deleteDialogState.txsToDelete);
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

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedTxs(paginatedTransactions);
      } else {
          setSelectedTxs([]);
      }
  }

  const handleSelectRow = (tx: StockTransaction, checked: boolean) => {
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

  const { currentStockWeight, currentStockValue, currentStockItems } = useMemo(() => {
    const items = (stockItems || []).map(item => ({
        name: item.name,
        weight: item.weight,
        avgPrice: item.purchasePricePerKg,
        totalValue: item.weight * item.purchasePricePerKg
    }));
    
    const totalWeight = items.reduce((acc, item) => acc + item.weight, 0);
    const totalValue = items.reduce((acc, item) => acc + item.totalValue, 0);
    
    return {
        currentStockWeight: totalWeight,
        currentStockValue: totalValue,
        currentStockItems: items.filter(item => item.weight > 0)
    };
}, [stockItems]);
  
  const { totalPurchaseWeight, totalSaleWeight, totalPurchaseValue, totalSaleValue } = useMemo(() => {
    return filteredByMonth.reduce((acc, tx) => {
        if (tx.type === 'purchase') {
            acc.totalPurchaseWeight += tx.weight;
            acc.totalPurchaseValue += tx.actual_amount;
        } else {
            acc.totalSaleWeight += tx.weight;
            acc.totalSaleValue += tx.actual_amount;
        }
        return acc;
    }, { totalPurchaseWeight: 0, totalSaleWeight: 0, totalPurchaseValue: 0, totalSaleValue: 0 });
  }, [filteredByMonth]);
  
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

  const renderDesktopHistory = () => (
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
            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('date')}>Date {renderSortArrow('date')}</Button></TableHead>
            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('description')}>Description {renderSortArrow('description')}</Button></TableHead>
            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('stockItemName')}>Item {renderSortArrow('stockItemName')}</Button></TableHead>
            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('weight')}>Weight (kg) {renderSortArrow('weight')}</Button></TableHead>
            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('type')}>Type {renderSortArrow('type')}</Button></TableHead>
            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('pricePerKg')}>Price/kg {renderSortArrow('pricePerKg')}</Button></TableHead>
            {showStockValue && <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('totalValue')}>Total Value {renderSortArrow('totalValue')}</Button></TableHead>}
            {showActions && <TableHead className="text-center">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <AnimatePresence>
        <TableBody>
          {isMonthLoading ? (
            <TableRow><TableCell colSpan={isSelectionMode ? 9 : 8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
          ) : paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((tx: StockTransaction) => (
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
                <TableCell className="text-left">{tx.description}</TableCell>
                <TableCell className="font-medium text-center">{tx.stockItemName}</TableCell>
                <TableCell className="text-center font-mono">{tx.weight.toFixed(2)} kg</TableCell>
                <TableCell className="text-center">
                  <span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full flex items-center justify-center w-fit mx-auto ${tx.type === 'purchase' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                    {tx.type === 'purchase' ? <ArrowDownCircle className="mr-1 h-3 w-3" /> : <ArrowUpCircle className="mr-1 h-3 w-3" />}
                    {tx.type}
                  </span>
                </TableCell>
                <TableCell className="text-center font-mono">{formatCurrency(tx.pricePerKg)}</TableCell>
                {showStockValue && <TableCell className={`text-center font-semibold font-mono ${tx.type === 'purchase' ? 'text-destructive' : 'text-accent'}`}>{formatCurrency(tx.actual_amount)}</TableCell>}
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
            ))
          ) : (
            <TableRow><TableCell colSpan={isSelectionMode ? (showActions ? (showStockValue ? 9 : 8) : (showStockValue ? 8 : 7)) : (showActions ? (showStockValue ? 8 : 7) : (showStockValue ? 7 : 6))} className="text-center h-24">No stock transactions for {format(currentMonth, "MMMM yyyy")}.</TableCell></TableRow>
          )}
        </TableBody>
        </AnimatePresence>
      </Table>
      </div>
  );

  const renderMobileHistory = () => (
    <div className="space-y-4">
      <AnimatePresence>
      {isMonthLoading ? (
        <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : paginatedTransactions.length > 0 ? (
        paginatedTransactions.map((tx: StockTransaction) => (
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
                        <div className={`font-semibold text-lg font-mono ${tx.type === 'sale' ? 'text-accent' : 'text-destructive'}`}>
                            {formatCurrency(tx.actual_amount)}
                        </div>
                        <Badge variant={tx.type === 'sale' ? 'default' : 'destructive'} className="capitalize bg-opacity-20 text-opacity-100">
                          {tx.type}
                        </Badge>
                    </div>
                    <div className="font-medium text-base">{tx.stockItemName}</div>
                    <p className="text-sm text-muted-foreground">{tx.description}</p>
                    <div className="flex justify-between text-sm pt-2 font-mono">
                        <span>{tx.weight.toFixed(2)} kg</span>
                        <span>@ {formatCurrency(tx.pricePerKg)}/kg</span>
                    </div>

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
        ))
      ) : (
        <div className="text-center text-muted-foreground py-12">
            No stock transactions for {format(currentMonth, "MMMM yyyy")}.
        </div>
      )}
      </AnimatePresence>
    </div>
  )

  const renderDesktopInventory = () => (
     <div className="overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="text-center">Item Name</TableHead>
                <TableHead className="text-center">Weight (kg)</TableHead>
                <TableHead className="text-center">Avg. Price/kg</TableHead>
                <TableHead className="text-center">Current Value</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {currentStockItems.length > 0 ? (
                currentStockItems.map((item, index) => (
                    <TableRow key={index}>
                    <TableCell className="font-medium text-center">{item.name}</TableCell>
                    <TableCell className="text-center font-mono">{item.weight.toFixed(2)}</TableCell>
                    <TableCell className="text-center font-mono">{formatCurrency(item.avgPrice)}</TableCell>
                    <TableCell className="text-center font-medium font-mono">{formatCurrency(item.totalValue)}</TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No stock items with current balance.</TableCell>
                </TableRow>
                )}
            </TableBody>
            {currentStockItems.length > 0 && (
                <TableFoot>
                    <TableRow>
                    <TableCell className="font-bold text-center">Totals</TableCell>
                    <TableCell className="text-center font-bold font-mono">{currentStockWeight.toFixed(2)} kg</TableCell>
                    <TableCell className="text-center font-bold font-mono">{formatCurrency(currentStockWeight > 0 ? currentStockValue / currentStockWeight : 0)}</TableCell>
                    <TableCell className="text-center font-bold font-mono">{formatCurrency(currentStockValue)}</TableCell>
                    </TableRow>
                </TableFoot>
            )}
        </Table>
    </div>
  )

  const renderMobileInventory = () => (
    <div className="space-y-4">
        {currentStockItems.length > 0 ? (
            currentStockItems.map((item, index) => (
                <Card key={index}>
                    <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                            <div className="font-semibold text-lg">{item.name}</div>
                            <div className="text-right">
                                <div className="font-bold text-primary text-xl font-mono">{formatCurrency(item.totalValue)}</div>
                                <div className="text-xs text-muted-foreground">Current Value</div>
                            </div>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground font-mono pt-2">
                            <span>{item.weight.toFixed(2)} kg</span>
                            <span>@ {formatCurrency(item.avgPrice)}/kg</span>
                        </div>
                    </CardContent>
                </Card>
            ))
        ) : (
            <div className="text-center text-muted-foreground py-12">No stock items with current balance.</div>
        )}

        {currentStockItems.length > 0 && (
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-base">Total Inventory Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                     <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Total Value</span>
                        <span className="font-bold font-mono">{formatCurrency(currentStockValue)}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span className="">Total Weight</span>
                        <span className="font-mono">{currentStockWeight.toFixed(2)} kg</span>
                    </div>
                     <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span className="">Avg. Price/kg</span>
                        <span className="font-mono">{formatCurrency(currentStockWeight > 0 ? currentStockValue / currentStockWeight : 0)}</span>
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  )

  return (
    <>
      <div className="space-y-6">
        <Tabs defaultValue="history" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="mt-6 animate-slide-in-up">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex-1">
                                <CardTitle>Stock Transaction History</CardTitle>
                                <CardDescription>A detailed log of all purchases and sales.</CardDescription>
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
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button size="sm" variant="outline" onClick={() => setShowStockValue(!showStockValue)}>
                                                <DollarSign className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>{showStockValue ? 'Hide' : 'Show'} Total Value Column</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {selectedTxs.length > 0 && (
                                    <Button size="sm" variant="destructive" onClick={handleMultiDeleteClick}>
                                        <Trash2 className="mr-2 h-4 w-4" /> ({selectedTxs.length})
                                    </Button>
                                )}
                            </div>
                        </div>}
                    </CardHeader>
                    <CardContent>
                    {filteredByMonth.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-muted/50 text-center">
                            <div className="md:border-r md:border-border md:pr-4">
                                <h4 className="font-semibold text-destructive">Monthly Purchases</h4>
                                <p className="font-mono">{totalPurchaseWeight.toFixed(2)} kg</p>
                                <p className="font-bold font-mono">{formatCurrency(totalPurchaseValue)}</p>
                            </div>
                            <div className="border-t border-border md:border-t-0 md:border-r md:border-border md:px-4 pt-4 md:pt-0">
                                <h4 className="font-semibold text-primary">Current Stock Balance</h4>
                                <p className="font-mono">{currentStockWeight.toFixed(2)} kg</p>
                                <p className="font-bold font-mono">{formatCurrency(currentStockValue)}</p>
                            </div>
                            <div className="border-t border-border md:border-t-0 md:pl-4 pt-4 md:pt-0">
                                <h4 className="font-semibold text-accent">Monthly Sales</h4>
                                <p className="font-mono">{totalSaleWeight.toFixed(2)} kg</p>
                                <p className="font-bold font-mono">{formatCurrency(totalSaleValue)}</p>
                            </div>
                        </div>
                    )}
                    {isMobile ? renderMobileHistory() : renderDesktopHistory()}
                    </CardContent>
                    {filteredByMonth.length > 0 && (
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
            </TabsContent>
            <TabsContent value="inventory" className="mt-6 animate-slide-in-up">
                <Card>
                    <CardHeader>
                    <CardTitle>Current Stock Inventory</CardTitle>
                    <CardDescription>An overview of your current stock levels and value.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isMobile ? renderMobileInventory() : renderDesktopInventory()}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
      {isAdmin && editSheetState.transaction && (
        <EditTransactionSheet 
          isOpen={editSheetState.isOpen}
          setIsOpen={(isOpen) => setEditSheetState({ isOpen, transaction: isOpen ? editSheetState.transaction : null })}
          transaction={editSheetState.transaction}
          transactionType="stock"
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
