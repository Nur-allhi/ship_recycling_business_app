
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
import type { CashTransaction, BankTransaction } from '@/lib/types';


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
    const pageCenter = doc.internal.pageSize.getWidth() / 2;
    const pageMargins = { left: 15, right: 15, top: 20, bottom: 20 };
    let tableData: any[] = [];
    let tableHeaders: any[] = [];
    let title = '';
    let columnStyles: any = {};
    const generationDate = new Date();
    
    const formatNumber = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const formatNumberOrCurrencyForPdf = (value: number) => {
        const prefix = currency === 'BDT' ? 'BDT' : currency;
        return `${prefix} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Header
    try {
      if (dataSource === 'cash') title = 'Cash Ledger';
      if (dataSource === 'bank') title = 'Bank Ledger';
      if (dataSource === 'stock') title = 'Stock Transactions';
      
      const headerYPos = 15;
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text("Ha-Mim Iron Mart", pageCenter, headerYPos, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.text(title, pageCenter, headerYPos + 8, { align: 'center' });


      const rightAlignX = doc.internal.pageSize.getWidth() - pageMargins.right;
      doc.setFontSize(9);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`From: ${format(dateRange.from, 'dd-MM-yyyy')}`, rightAlignX, headerYPos, { align: 'right' });
      doc.text(`To: ${format(dateRange.to, 'dd-MM-yyyy')}`, rightAlignX, headerYPos + 5, { align: 'right' });
      doc.text(`Generated: ${format(generationDate, 'dd-MM-yyyy HH:mm')}`, rightAlignX, headerYPos + 10, { align: 'right' });

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
        
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0,0,0,0);

        const toDate = new Date(dateRange.to);
        toDate.setHours(23,59,59,999);

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
        
        tableHeaders = [['Date', 'Description', 'Category', 'In', 'Out', 'Balance']];
        tableData = txsInRange.map(tx => {
            const isIncome = tx.type === 'income' || tx.type === 'deposit';
            balance += isIncome ? tx.amount : -tx.amount;
            return [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.description,
                tx.category,
                isIncome ? formatNumberOrCurrencyForPdf(tx.amount) : '',
                !isIncome ? formatNumberOrCurrencyForPdf(tx.amount) : '',
                formatNumberOrCurrencyForPdf(balance),
            ]
        });

        columnStyles = { 
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
        };

    } else { // Stock
        tableHeaders = [['Date', 'Description', 'Item', 'Type', 'Weight (kg)', 'Price/kg', 'Total Value']];
        tableData = stockTransactions
            .filter(tx => {
                const txDate = new Date(tx.date);
                return txDate >= dateRange.from! && txDate <= dateRange.to!;
            })
            .map(tx => [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.description || '',
                tx.stockItemName,
                tx.type,
                tx.weight.toFixed(2),
                formatNumberOrCurrencyForPdf(tx.pricePerKg),
                formatNumberOrCurrencyForPdf(tx.weight * tx.pricePerKg)
            ]);
        columnStyles = { 
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
        };
    }

    doc.autoTable({
        startY: 40,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [34, 49, 63],
            textColor: 255,
            fontStyle: 'bold',
        },
        columnStyles: columnStyles,
        didDrawPage: (data) => {
            // Footer
            const pageCount = doc.internal.pages.length;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                'System Generated Report',
                data.settings.margin.left,
                doc.internal.pageSize.getHeight() - 10
            );
            doc.text(
                `Page ${data.pageNumber} of ${pageCount - 1 > 0 ? pageCount - 1 : 1}`,
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
