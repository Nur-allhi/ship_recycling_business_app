
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

interface PdfExportDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

type DataSource = 'cash' | 'bank' | 'stock';

export function PdfExportDialog({ isOpen, setIsOpen }: PdfExportDialogProps) {
  const { cashTransactions, bankTransactions, stockTransactions, currency, organizationName } = useAppContext();
  const { toast } = useToast();
  const [dataSource, setDataSource] = useState<DataSource>('cash');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const handleExport = () => {
    if (!dateRange.from || !dateRange.to) {
        toast({
            variant: 'destructive',
            title: 'Invalid Date Range',
            description: 'Please select both a start and end date.'
        });
        return;
    }

    const doc = new jsPDF();
    let tableData: any[] = [];
    let tableHeaders: string[] = [];
    let title = '';

    const filteredData = (data: any[]) => {
        return data.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= dateRange.from! && txDate <= dateRange.to!;
        });
    }

    switch (dataSource) {
        case 'cash':
            title = 'Cash Transactions';
            tableHeaders = ['Date', 'Description', 'Category', 'Type', 'Amount'];
            tableData = filteredData(cashTransactions).map(tx => [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.description,
                tx.category,
                tx.type,
                formatCurrency(tx.amount)
            ]);
            break;
        case 'bank':
            title = 'Bank Transactions';
            tableHeaders = ['Date', 'Description', 'Category', 'Type', 'Amount'];
            tableData = filteredData(bankTransactions).map(tx => [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.description,
                tx.category,
                tx.type,
                formatCurrency(tx.amount)
            ]);
            break;
        case 'stock':
            title = 'Stock Transactions';
            tableHeaders = ['Date', 'Item', 'Type', 'Weight (kg)', 'Price/kg', 'Total Value'];
            tableData = filteredData(stockTransactions).map(tx => [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.stockItemName,
                tx.type,
                tx.weight.toFixed(2),
                formatCurrency(tx.pricePerKg),
                formatCurrency(tx.weight * tx.pricePerKg)
            ]);
            break;
    }

    doc.setFontSize(18);
    doc.text(organizationName || 'ShipShape Ledger', 14, 22);
    doc.setFontSize(14);
    doc.text(title, 14, 30);
    doc.setFontSize(10);
    doc.text(
      `From: ${format(dateRange.from, 'dd-MM-yyyy')} To: ${format(dateRange.to, 'dd-MM-yyyy')}`,
      14, 36
    );

    (doc as any).autoTable({
        startY: 40,
        head: [tableHeaders],
        body: tableData,
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
