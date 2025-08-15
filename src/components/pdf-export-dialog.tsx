
"use client";

import { useState } from 'react';
import { useAppContext } from '@/app/store';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { CashTransaction, BankTransaction, StockTransaction } from '@/lib/types';


interface PdfExportDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

type DataSource = 'cash' | 'bank' | 'stock';

// Extend the jsPDF interface to include autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export function PdfExportDialog({ isOpen, setIsOpen }: PdfExportDialogProps) {
  const { cashTransactions, bankTransactions, stockTransactions, currency } = useAppContext();
  const { toast } = useToast();
  const [dataSource, setDataSource] = useState<DataSource>('cash');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const handleExport = async () => {
    if (!dateRange.from || !dateRange.to) {
        toast({
            variant: 'destructive',
            title: 'Invalid Date Range',
            description: 'Please select both a start and end date.'
        });
        return;
    }

    const doc = new jsPDF();
    
    const pageMargins = { left: 15, right: 15, top: 20, bottom: 20 };
    let tableData: any[] = [];
    let tableHeaders: any[] = [];
    let columnStyles: any = {};
    const generationDate = new Date();
    
    const formatCurrencyForPdf = (value: number) => {
        const prefix = currency === 'BDT' ? 'BDT' : currency;
        // The space is intentional for readability
        return `${prefix} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    const fromDate = new Date(dateRange.from);
    fromDate.setHours(0,0,0,0);

    const toDate = new Date(dateRange.to);
    toDate.setHours(23,59,59,999);

    // Header
    try {
      let title = '';
      if (dataSource === 'cash') title = 'Cash Ledger';
      if (dataSource === 'bank') title = 'Bank Ledger';
      if (dataSource === 'stock') title = 'Stock Transactions';
      
      const headerYPos = 15;
      const rightAlignX = doc.internal.pageSize.getWidth() - pageMargins.right;
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`From: ${format(dateRange.from, 'dd-MM-yyyy')}`, pageMargins.left, headerYPos);
      doc.text(`To: ${format(dateRange.to, 'dd-MM-yyyy')}`, pageMargins.left, headerYPos + 5);
      doc.text(`Generated: ${format(generationDate, 'dd-MM-yyyy HH:mm')}`, pageMargins.left, headerYPos + 10);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.text("Ha-Mim Iron Mart", rightAlignX, headerYPos, { align: 'right' });
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(14);
      doc.text(title, rightAlignX, headerYPos + 8, { align: 'right' });


    } catch (e) {
      console.error("Failed to build PDF header:", e);
      toast({
        variant: 'destructive',
        title: 'PDF Error',
        description: 'Could not generate the PDF header.'
      })
    }
    
    
    if (dataSource === 'cash' || dataSource === 'bank') {
        const allTxs: (CashTransaction | BankTransaction)[] = dataSource === 'cash' ? [...cashTransactions] : [...bankTransactions];
        
        const txsBeforeRange = allTxs.filter(tx => new Date(tx.date) < fromDate);
        
        let balance = txsBeforeRange.reduce((acc, tx) => {
             const amount = (tx.type === 'income' || tx.type === 'deposit') ? tx.amount : -tx.amount;
             return acc + amount;
        }, 0);

        const txsInRange = allTxs
            .filter(tx => {
                const txDate = new Date(tx.date);
                return txDate >= fromDate && txDate <= toDate;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const { totalCredit, totalDebit } = txsInRange.reduce((acc, tx) => {
            const isCredit = tx.type === 'income' || tx.type === 'deposit';
            if (isCredit) {
                acc.totalCredit += tx.amount;
            } else {
                acc.totalDebit += tx.amount;
            }
            return acc;
        }, { totalCredit: 0, totalDebit: 0 });
        
        const rightAlignX = doc.internal.pageSize.getWidth() - pageMargins.right;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Total Credit:`, rightAlignX - 50, 30, { align: 'left'});
        doc.text(`Total Debit:`, rightAlignX - 50, 35, { align: 'left'});
        doc.setFont('Courier', 'normal');
        doc.text(formatCurrencyForPdf(totalCredit), rightAlignX, 30, { align: 'right'});
        doc.text(formatCurrencyForPdf(totalDebit), rightAlignX, 35, { align: 'right'});
        
        tableHeaders = [['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance']];
        tableData = txsInRange.map(tx => {
            const isCredit = tx.type === 'income' || tx.type === 'deposit';
            balance += isCredit ? tx.amount : -tx.amount;
            return [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.description,
                tx.category,
                !isCredit ? formatCurrencyForPdf(tx.amount) : '',
                isCredit ? formatCurrencyForPdf(tx.amount) : '',
                formatCurrencyForPdf(balance),
            ]
        });

        columnStyles = { 
            3: { halign: 'right', font: 'Courier', textColor: [0,0,0] },
            4: { halign: 'right', font: 'Courier', textColor: [0,0,0] },
            5: { halign: 'right', font: 'Courier', fontStyle: 'bold', textColor: [0,0,0] },
            0: { font: 'Courier', textColor: [0,0,0] } // Date column
        };

    } else { // Stock
        const txsInRange = stockTransactions
            .filter(tx => {
                const txDate = new Date(tx.date);
                return txDate >= fromDate && txDate <= toDate;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const { totalPurchase, totalSale } = txsInRange.reduce((acc, tx) => {
            if (tx.type === 'purchase') {
                acc.totalPurchase += tx.weight * tx.pricePerKg;
            } else {
                acc.totalSale += tx.weight * tx.pricePerKg;
            }
            return acc;
        }, { totalPurchase: 0, totalSale: 0 });

        const rightAlignX = doc.internal.pageSize.getWidth() - pageMargins.right;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Total Purchase:`, rightAlignX - 50, 30, { align: 'left'});
        doc.text(`Total Sale:`, rightAlignX - 50, 35, { align: 'left'});
        doc.setFont('Courier', 'normal');
        doc.text(formatCurrencyForPdf(totalPurchase), rightAlignX, 30, { align: 'right'});
        doc.text(formatCurrencyForPdf(totalSale), rightAlignX, 35, { align: 'right'});

        tableHeaders = [['Date', 'Description', 'Item', 'Purchase (kg)', 'Sale (kg)', 'Price/kg', 'Balance (kg)']];

        const itemBalances: Record<string, number> = {};

        tableData = txsInRange.map(tx => {
            if (itemBalances[tx.stockItemName] === undefined) {
                itemBalances[tx.stockItemName] = 0;
            }
            
            if (tx.type === 'purchase') {
                itemBalances[tx.stockItemName] += tx.weight;
            } else {
                itemBalances[tx.stockItemName] -= tx.weight;
            }

            return [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.description || '',
                tx.stockItemName,
                tx.type === 'purchase' ? tx.weight.toFixed(2) : '',
                tx.type === 'sale' ? tx.weight.toFixed(2) : '',
                formatCurrencyForPdf(tx.pricePerKg),
                itemBalances[tx.stockItemName].toFixed(2)
            ];
        });
        columnStyles = { 
            3: { halign: 'right', font: 'Courier', textColor: [0,0,0] },
            4: { halign: 'right', font: 'Courier', textColor: [0,0,0] },
            5: { halign: 'right', font: 'Courier', textColor: [0,0,0] },
            6: { halign: 'right', font: 'Courier', fontStyle: 'bold', textColor: [0,0,0] },
            0: { font: 'Courier', textColor: [0,0,0] } // Date column
        };
    }

    doc.autoTable({
        startY: 45,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        styles: {
            font: 'Helvetica',
            fontSize: 9,
            textColor: [0,0,0],
        },
        headStyles: {
            fillColor: [34, 49, 63],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center', // Center align all headers
        },
        columnStyles: columnStyles,
        didDrawPage: (data) => {
            // Footer
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                'System Generated Report',
                data.settings.margin.left,
                doc.internal.pageSize.getHeight() - 10
            );
            doc.text(
                `Page ${data.pageNumber} of ${doc.internal.pages.length - 1 > 0 ? doc.internal.pages.length - 1 : 1}`,
                doc.internal.pageSize.getWidth() - data.settings.margin.right,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'right' }
            );
        },
    });

    doc.save(`${dataSource}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'Export Successful', description: 'Your PDF has been generated.' });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center"><FileText className="mr-2 h-5 w-5" /> Export to PDF</DialogTitle>
          <DialogDescription>
            Select a data source and date range to generate a PDF report.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="data-source">Data Source</Label>
            <Select value={dataSource} onValueChange={(value) => setDataSource(value as DataSource)}>
              <SelectTrigger id="data-source">
                <SelectValue placeholder="Select a ledger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash Ledger</SelectItem>
                <SelectItem value="bank">Bank Ledger</SelectItem>
                <SelectItem value="stock">Stock History</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
               <Popover>
                  <PopoverTrigger asChild>
                  <Button
                      variant={"outline"}
                      className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                      )}
                  >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, "dd-MM-yyyy") : <span>Pick a date</span>}
                  </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                      <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange(prev => ({...prev, from: date!}))}
                          initialFocus
                      />
                  </PopoverContent>
              </Popover>
            </div>
             <div className="space-y-2">
              <Label>To</Label>
               <Popover>
                  <PopoverTrigger asChild>
                  <Button
                      variant={"outline"}
                      className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                      )}
                  >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, "dd-MM-yyyy") : <span>Pick a date</span>}
                  </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                      <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange(prev => ({...prev, to: date!}))}
                          initialFocus
                      />
                  </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleExport}>Generate PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    