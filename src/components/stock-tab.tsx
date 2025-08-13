
"use client"

import { useState, useMemo } from "react"
import { useAppContext } from "@/app/store"
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
import { ArrowUpCircle, ArrowDownCircle, Pencil, History, Trash2, CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react"
import type { StockItem, StockTransaction } from "@/lib/types"
import { EditTransactionSheet } from "./edit-transaction-sheet"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Checkbox } from "./ui/checkbox"
import { format, subMonths, addMonths } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "./ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function StockTab() {
  const { stockItems, stockTransactions, deleteStockTransaction, deleteMultipleStockTransactions, currency, showStockValue } = useAppContext()
  const [editSheetState, setEditSheetState] = useState<{isOpen: boolean, transaction: StockTransaction | null}>({ isOpen: false, transaction: null});
  const [deleteDialogState, setDeleteDialogState] = useState<{isOpen: boolean, txId: string | null, txIds: string[] | null}>({ isOpen: false, txId: null, txIds: null });
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showActions, setShowActions] = useState(false);
  const isMobile = useIsMobile();

  const filteredByMonth = useMemo(() => {
    return stockTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === currentMonth.getFullYear() && txDate.getMonth() === currentMonth.getMonth();
    })
  }, [stockTransactions, currentMonth]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredByMonth.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredByMonth, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(filteredByMonth.length / itemsPerPage);

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

  const totalStockValue = stockItems.reduce((acc, item) => acc + (item.weight * item.purchasePricePerKg), 0);
  const totalStockWeight = stockItems.reduce((acc, item) => acc + item.weight, 0);
  const weightedAveragePrice = totalStockWeight > 0 ? totalStockValue / totalStockWeight : 0;
  
  const { totalPurchaseWeight, totalSaleWeight, totalPurchaseValue, totalSaleValue } = useMemo(() => {
    return filteredByMonth.reduce((acc, tx) => {
        if (tx.type === 'purchase') {
            acc.totalPurchaseWeight += tx.weight;
            acc.totalPurchaseValue += tx.weight * tx.pricePerKg;
        } else {
            acc.totalSaleWeight += tx.weight;
            acc.totalSaleValue += tx.weight * tx.pricePerKg;
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

  const renderDesktopHistory = () => (
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
            <TableHead>Type</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead className="text-right">Price/kg</TableHead>
            {showStockValue && <TableHead className="text-right">Total Value</TableHead>}
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTransactions.length > 0 ? (
            paginatedTransactions.map((tx: StockTransaction) => (
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
                    <span className="font-mono">{new Date(tx.date).toLocaleDateString()}</span>
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
                <TableCell className="text-right font-mono">{tx.weight.toFixed(2)} kg</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(tx.pricePerKg)}</TableCell>
                {showStockValue && <TableCell className={`text-right font-semibold font-mono ${tx.type === 'purchase' ? 'text-destructive' : 'text-accent'}`}>{formatCurrency(tx.weight * tx.pricePerKg)}</TableCell>}
                {showActions && (
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
                )}
              </TableRow>
            ))
          ) : (
            <TableRow><TableCell colSpan={isSelectionMode ? (showActions ? (showStockValue ? 9 : 8) : (showStockValue ? 8 : 7)) : (showActions ? (showStockValue ? 8 : 7) : (showStockValue ? 7 : 6))} className="text-center h-24">No stock transactions for {format(currentMonth, "MMMM yyyy")}.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      </div>
  );

  const renderMobileHistory = () => (
    <div className="space-y-4">
      {paginatedTransactions.length > 0 ? (
        paginatedTransactions.map((tx: StockTransaction) => (
            <Card key={tx.id} className="relative animate-fade-in">
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
                        <div className={`font-semibold text-lg font-mono ${tx.type === 'sale' ? 'text-accent' : 'text-destructive'}`}>
                            {formatCurrency(tx.weight * tx.pricePerKg)}
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
                        {showActions && (
                          <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(tx)}>
                                  <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(tx.id)}>
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
            No stock transactions for {format(currentMonth, "MMMM yyyy")}.
        </div>
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
                        <div className="flex flex-col items-center justify-center gap-2 pt-4">
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
                                {selectedTxIds.length > 0 && (
                                    <Button size="sm" variant="destructive" onClick={handleMultiDeleteClick}>
                                        <Trash2 className="mr-2 h-4 w-4" /> ({selectedTxIds.length})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                    {filteredByMonth.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                            <div>
                            <h4 className="font-semibold text-destructive">Monthly Purchases</h4>
                            <p className="font-mono">{totalPurchaseWeight.toFixed(2)} kg</p>
                            <p className="font-bold font-mono">{formatCurrency(totalPurchaseValue)}</p>
                            </div>
                            <div>
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
            </TabsContent>
            <TabsContent value="inventory" className="mt-6 animate-slide-in-up">
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
                                <TableCell className="text-right font-mono">{item.weight.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.purchasePricePerKg)}</TableCell>
                                <TableCell className="text-right font-medium font-mono">{formatCurrency(item.weight * item.purchasePricePerKg)}</TableCell>
                                </TableRow>
                            ))
                            ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">No stock items yet.</TableCell>
                            </TableRow>
                            )}
                        </TableBody>
                        {stockItems.length > 0 && (
                            <TableFoot>
                                <TableRow>
                                <TableCell className="font-bold">Totals</TableCell>
                                <TableCell className="text-right font-bold font-mono">{totalStockWeight.toFixed(2)} kg</TableCell>
                                <TableCell className="text-right font-bold font-mono">{formatCurrency(weightedAveragePrice)}</TableCell>
                                <TableCell className="text-right font-bold font-mono">{formatCurrency(totalStockValue)}</TableCell>
                                </TableRow>
                            </TableFoot>
                        )}
                        </Table>
                    </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
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
