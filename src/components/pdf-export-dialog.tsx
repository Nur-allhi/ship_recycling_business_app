
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
import { toast } from 'sonner';
import { CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { CashTransaction, BankTransaction, StockTransaction } from '@/lib/types';
import { readData } from '@/app/actions';


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
  const { currency, banks } = useAppContext();
  const [dataSource, setDataSource] = useState<DataSource>('cash');
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!dateRange.from || !dateRange.to) {
        toast.error('Invalid Date Range', {
            description: 'Please select both a start and end date.'
        });
        return;
    }

    setIsExporting(true);

    try {
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0,0,0,0);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23,59,59,999);

        // Fetch ALL data for the given range, ignoring what's in the state
        const [cashTransactions, bankTransactions, stockTransactions] = await Promise.all([
            readData({ tableName: 'cash_transactions', startDate: fromDate.toISOString(), endDate: toDate.toISOString() }),
            readData({ tableName: 'bank_transactions', startDate: fromDate.toISOString(), endDate: toDate.toISOString() }),
            readData({ tableName: 'stock_transactions', startDate: fromDate.toISOString(), endDate: toDate.toISOString() }),
        ]);

        const doc = new jsPDF();
        doc.setFont('Helvetica', 'normal');
        
        const pageMargins = { left: 15, right: 15, top: 20, bottom: 20 };
        let tableData: any[] = [];
        let tableHeaders: any[] = [];
        let columnStyles: any = {};
        const generationDate = new Date();
        
        const formatCurrencyForPdf = (value: number) => {
            if (!value && value !== 0) return '';
            const prefix = currency === 'BDT' ? 'BDT' : currency;
            return `${prefix} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        
        let finalY = 0;

        // Header
        let title = '';
        if (dataSource === 'cash') title = 'Cash Ledger';
        if (dataSource === 'bank') {
            const selectedBank = banks.find(b => b.id === selectedBankId);
            title = selectedBank ? `Bank Ledger - ${selectedBank.name}` : 'Bank Ledger - All Accounts';
        }
        if (dataSource === 'stock') title = 'Stock Transactions';
        
        const centerX = doc.internal.pageSize.getWidth() / 2;
        doc.setFontSize(18);
        doc.text("Ha-Mim Iron Mart", centerX, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text(title, centerX, 22, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`From: ${format(dateRange.from, 'dd-MM-yyyy')}`, pageMargins.left, 15);
        doc.text(`To: ${format(dateRange.to, 'dd-MM-yyyy')}`, pageMargins.left, 20);
        doc.text(`Generated: ${format(generationDate, 'dd-MM-yyyy HH:mm')}`, pageMargins.left, 25);
        
        finalY = 35;
        
        if (dataSource === 'cash' || dataSource === 'bank') {
            let allTxs: (CashTransaction | BankTransaction)[] = dataSource === 'cash' ? [...cashTransactions] : [...bankTransactions];
            if (dataSource === 'bank' && selectedBankId !== 'all') {
                allTxs = allTxs.filter(tx => (tx as BankTransaction).bank_id === selectedBankId);
            }

            const { totalCredit, totalDebit } = allTxs.reduce((acc, tx) => {
                const isCredit = tx.type === 'income' || tx.type === 'deposit';
                if (isCredit) acc.totalCredit += tx.actual_amount;
                else acc.totalDebit += tx.actual_amount;
                return acc;
            }, { totalCredit: 0, totalDebit: 0 });
            
            const rightAlignX = doc.internal.pageSize.getWidth() - pageMargins.right;
            doc.setFontSize(9);
            doc.text(`Total Credit:`, rightAlignX - 45, 15, { align: 'left'});
            doc.text(`Total Debit:`, rightAlignX - 45, 20, { align: 'left'});
            doc.text(formatCurrencyForPdf(totalCredit), rightAlignX, 15, { align: 'right'});
            doc.text(formatCurrencyForPdf(totalDebit), rightAlignX, 20, { align: 'right'});
            
            const baseHeaders = ['Date', 'Description', 'Category', 'Expected', 'Actual', 'Diff.', 'Reason'];
            if (dataSource === 'bank' && selectedBankId === 'all') {
                baseHeaders.splice(2, 0, 'Bank');
            }
            tableHeaders = [baseHeaders];

            tableData = allTxs.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tx => {
                const baseRow = [
                    format(new Date(tx.date), 'dd-MM-yyyy'),
                    tx.description,
                    tx.category,
                    formatCurrencyForPdf(tx.expected_amount),
                    formatCurrencyForPdf(tx.actual_amount),
                    formatCurrencyForPdf(tx.difference),
                    tx.difference_reason || '',
                ];
                if (dataSource === 'bank' && selectedBankId === 'all') {
                    const bankName = banks.find(b => b.id === (tx as BankTransaction).bank_id)?.name || 'N/A';
                    baseRow.splice(2, 0, bankName);
                }
                return baseRow;
            });

            columnStyles = { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }};
            if (dataSource === 'bank' && selectedBankId === 'all') {
                columnStyles = { ...columnStyles, 4: { halign: 'right'}, 5: { halign: 'right'}, 6: { halign: 'right' }};
            }

        } else { // Stock
            const { totalPurchaseValue, totalSaleValue } = stockTransactions.reduce((acc, tx) => {
                if (tx.type === 'purchase') acc.totalPurchaseValue += tx.actual_amount;
                else acc.totalSaleValue += tx.actual_amount;
                return acc;
            }, { totalPurchaseValue: 0, totalSaleValue: 0 });

            const rightAlignX = doc.internal.pageSize.getWidth() - pageMargins.right;
            doc.setFontSize(9);
            doc.text(`Total Purchase:`, rightAlignX - 45, 15, { align: 'left'});
            doc.text(`Total Sale:`, rightAlignX - 45, 20, { align: 'left'});
            doc.text(formatCurrencyForPdf(totalPurchaseValue), rightAlignX, 15, { align: 'right'});
            doc.text(formatCurrencyForPdf(totalSaleValue), rightAlignX, 20, { align: 'right'});

            tableHeaders = [['Date', 'Description', 'Item', 'Type', 'Weight (kg)', 'Expected', 'Actual', 'Diff.', 'Reason']];

            tableData = stockTransactions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tx => [
                format(new Date(tx.date), 'dd-MM-yyyy'),
                tx.description || '',
                tx.stockItemName,
                tx.type,
                tx.weight.toFixed(2),
                formatCurrencyForPdf(tx.expected_amount),
                formatCurrencyForPdf(tx.actual_amount),
                formatCurrencyForPdf(tx.difference),
                tx.difference_reason || '',
            ]);
            columnStyles = { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }};
        }

        doc.autoTable({
            startY: finalY,
            head: tableHeaders,
            body: tableData,
            theme: 'grid',
            styles: { font: 'Helvetica', fontSize: 8 },
            headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: columnStyles,
            didDrawPage: (data) => {
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('System Generated Report', data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
                doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.getWidth() - data.settings.margin.right, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            },
        });

        const fileName = `${dataSource}_report_${selectedBankId !== 'all' ? banks.find(b=>b.id===selectedBankId)?.name.toLowerCase().replace(' ','_') : ''}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);
        toast.success('Export Successful', { description: 'Your PDF has been generated.' });
        setIsOpen(false);
    } catch (error) {
        console.error("PDF Export failed:", error);
        toast.error("Export Failed", { description: "Could not fetch data for the PDF report."})
    } finally {
        setIsExporting(false);
    }
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

          {dataSource === 'bank' && (
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="bank-account">Bank Account</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger id="bank-account">
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks (Consolidated)</SelectItem>
                  {banks.map(bank => (
                    <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            <Button onClick={handleExport} disabled={isExporting}>
                {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate PDF
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
