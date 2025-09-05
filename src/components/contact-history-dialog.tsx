
"use client";

import { useMemo, useEffect, useState } from "react";
import { useAppContext } from "@/app/context/app-context";
import type { Contact, LedgerTransaction, CashTransaction, BankTransaction } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import { Button } from "./ui/button";
import { FileText, ArrowRight, Loader2 } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';

interface ContactHistoryDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  contact: Contact;
}

declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

type CombinedHistoryItem = (LedgerTransaction & { itemType: 'ledger' }) | ((CashTransaction | BankTransaction) & { itemType: 'payment' });

export function ContactHistoryDialog({ isOpen, setIsOpen, contact }: ContactHistoryDialogProps) {
  const { ledgerTransactions, currency, cashTransactions, bankTransactions } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [combinedHistory, setCombinedHistory] = useState<CombinedHistoryItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);

    // 1. Get all A/R or A/P ledger entries for this contact
    const arApTxs: CombinedHistoryItem[] = ledgerTransactions
      .filter(tx => tx.contact_id === contact.id)
      .map(tx => ({ ...tx, itemType: 'ledger' }));

    // 2. Get all cash and bank payments related to this contact
    const relevantCashTxs: CombinedHistoryItem[] = cashTransactions
      .filter(tx => tx.contact_id === contact.id && (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement'))
      .map(tx => ({ ...tx, itemType: 'payment' }));

    const relevantBankTxs: CombinedHistoryItem[] = bankTransactions
      .filter(tx => tx.contact_id === contact.id && (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement'))
      .map(tx => ({ ...tx, itemType: 'payment' }));
      
    // 3. Combine and sort all transactions chronologically
    const allHistory = [...arApTxs, ...relevantCashTxs, ...relevantBankTxs];
    allHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setCombinedHistory(allHistory);
    setIsLoading(false);
  }, [isOpen, ledgerTransactions, cashTransactions, bankTransactions, contact.id]);

  const { totalDebit, totalCredit, finalBalance } = useMemo(() => {
    let debit = 0;
    let credit = 0;
    
    combinedHistory.forEach(item => {
        if (item.itemType === 'ledger') {
             if (item.type === 'advance') {
                credit += Math.abs(item.amount);
             } else if (item.type === 'receivable') { // We owe them money
                debit += item.amount;
             } else if (item.type === 'payable') { // They owe us money
                debit += item.amount;
             }
        } else { // payment
             if (contact.type === 'vendor') { // We paid a vendor
                credit += item.actual_amount;
             } else { // We received from a client
                credit += item.actual_amount;
             }
        }
    });

    const finalDebit = contact.type === 'vendor' ? totalCredit : totalDebit;
    const finalCredit = contact.type === 'vendor' ? totalDebit : totalCredit;

    return { totalDebit: debit, totalCredit: credit, finalBalance: debit - credit };
  }, [combinedHistory, contact.type]);


  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const formatCurrencyForPdf = (amount: number) => {
    if (amount === 0 || !amount) return '-';
    const prefix = currency === 'BDT' ? 'BDT' : currency; 
    return `${prefix} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');

    const pageMargins = { top: 20, right: 15, bottom: 20, left: 15 };
    const centerX = doc.internal.pageSize.getWidth() / 2;

    doc.setFontSize(18);
    doc.text("Ha-Mim Iron Mart", centerX, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`${contact.type === 'vendor' ? 'Vendor' : 'Client'} Statement`, centerX, 22, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(contact.name, centerX, 29, { align: 'center' });

    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`, pageMargins.left, 15);

    let runningBalance = 0;
    const tableData = combinedHistory.map(item => {
        let debit = 0;
        let credit = 0;
        let description = '';

        if (item.itemType === 'ledger') {
            if (item.type === 'advance') {
                credit = Math.abs(item.amount);
                runningBalance -= credit;
            } else {
                debit = item.amount;
                runningBalance += debit;
            }
            description = item.description;
        } else { // payment
            credit = item.actual_amount;
            runningBalance -= credit;
            description = `Payment Received/Made`;
        }

        return [
            format(new Date(item.date), 'dd-MM-yy'),
            description,
            debit > 0 ? formatCurrencyForPdf(debit) : '-',
            credit > 0 ? formatCurrencyForPdf(credit) : '-',
            formatCurrencyForPdf(runningBalance),
        ]
    });

    const footerData = [
        ['', 'Total Debit', '', formatCurrencyForPdf(totalDebit), ''],
        ['', 'Total Credit', '', formatCurrencyForPdf(totalCredit), ''],
        ['', 'Balance Due', '', '', formatCurrencyForPdf(finalBalance)]
    ]

    doc.autoTable({
        startY: 35,
        head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
        body: tableData,
        foot: footerData,
        theme: 'grid',
        styles: { font: 'Helvetica', fontSize: 9, },
        headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [236, 240, 241], textColor: [44, 62, 80], fontStyle: 'bold', },
        columnStyles: {
            0: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        },
        didParseCell: function(data: any) {
            if (data.section === 'foot') {
                if (data.column.index === 1) data.cell.styles.halign = 'right';
                if (data.column.index >= 2) data.cell.styles.halign = 'right';
                if(data.row.index === 2) data.cell.styles.fontSize = 10;
            }
        },
        didDrawPage: (data: any) => {
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text( 'System Generated Report', data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
            doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.getWidth() - data.settings.margin.right, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        },
    });

    doc.save(`${contact.name}_statement_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success("PDF Exported", { description: `Statement for ${contact.name} has been saved.`});
  }


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Transaction History: {contact.name}</DialogTitle>
          <DialogDescription>
            A complete record of all transactions with this <span className="capitalize font-medium">{contact.type}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 my-4 p-4 rounded-lg bg-muted/50">
            <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Debit</p>
                <p className="text-xl font-bold font-mono">{formatCurrency(totalDebit)}</p>
            </div>
             <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Credit</p>
                <p className="text-xl font-bold font-mono text-green-600">{formatCurrency(totalCredit)}</p>
            </div>
             <div className="text-center">
                <p className="text-sm text-muted-foreground">Balance Due</p>
                <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(finalBalance)}</p>
            </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto pr-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                         <TableRow>
                            <TableCell colSpan={5} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell>
                        </TableRow>
                    ) : combinedHistory.length > 0 ? (() => {
                        let balance = 0;
                        return combinedHistory.map((item, index) => {
                            let debit = 0;
                            let credit = 0;
                            
                            if (item.itemType === 'ledger') {
                                if (item.type === 'advance') {
                                    credit = Math.abs(item.amount);
                                    balance -= credit;
                                } else {
                                    debit = item.amount;
                                    balance += debit;
                                }
                            } else { // Payment
                                credit = item.actual_amount;
                                balance -= credit;
                            }

                            return (
                                <TableRow key={item.id + index}>
                                    <TableCell className="font-mono">{format(new Date(item.date), 'dd-MM-yy')}</TableCell>
                                    <TableCell>
                                        {item.itemType === 'payment' ? (
                                            <div className="flex items-center gap-2 text-sm text-green-600">
                                                <ArrowRight className="h-4 w-4"/>
                                                <span className="italic">Payment {contact.type === 'vendor' ? 'Made' : 'Received'}</span>
                                            </div>
                                        ) : (
                                           <span className={item.type === 'advance' ? 'text-blue-600' : ''}>{item.description}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{debit > 0 ? formatCurrency(debit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono text-green-600">{credit > 0 ? formatCurrency(credit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold">{formatCurrency(balance)}</TableCell>
                                </TableRow>
                            );
                        });
                    })() : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">No transactions found for this {contact.type}.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
        <DialogFooter>
          <Button onClick={handleExportPdf} disabled={isLoading}>
              <FileText className="mr-2 h-4 w-4" />
              Export to PDF
          </Button>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
