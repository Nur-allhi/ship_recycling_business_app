
"use client";

import { useMemo } from "react";
import { useAppContext } from "@/app/context/app-context";
import type { Vendor, Client, LedgerTransaction, PaymentInstallment } from "@/lib/types";
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
import { FileText, ArrowRight } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';

interface ContactHistoryDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  contact: Vendor | Client;
  contactType: 'vendor' | 'client';
}

declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

// Type guard to check if an item is a PaymentInstallment
const isPaymentInstallment = (item: any): item is PaymentInstallment & { originalDescription: string, isSettlement: true } => {
    return 'isSettlement' in item;
};

export function ContactHistoryDialog({ isOpen, setIsOpen, contact, contactType }: ContactHistoryDialogProps) {
  const { ledgerTransactions, currency } = useAppContext();

  const transactions = useMemo(() => {
    return ledgerTransactions
        .filter(tx => tx.contact_id === contact.id)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [ledgerTransactions, contact.id]);

  const combinedHistory = useMemo(() => {
    const history: (LedgerTransaction | (PaymentInstallment & { originalDescription: string, isSettlement: true }))[] = [];
    transactions.forEach(tx => {
        history.push(tx);
        // Ensure installments is an array before trying to iterate
        if (Array.isArray(tx.installments)) {
            tx.installments.forEach(inst => {
                history.push({ ...inst, originalDescription: tx.description, isSettlement: true });
            });
        }
    });
    return history.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // If dates are the same, settlements should come after the charge
        if(isPaymentInstallment(a) && !isPaymentInstallment(b)) return 1;
        if(!isPaymentInstallment(a) && isPaymentInstallment(b)) return -1;
        return 0;
    });
  }, [transactions]);


  const { totalDebit, totalCredit, finalBalance } = useMemo(() => {
    let debit = 0;
    let credit = 0;
    transactions.forEach(tx => {
        if (tx.type === 'advance') {
            credit += Math.abs(tx.amount);
        } else {
            debit += tx.amount;
            credit += tx.paid_amount;
        }
    });
    return { totalDebit: debit, totalCredit: credit, finalBalance: debit - credit };
  }, [transactions]);


  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const formatCurrencyForPdf = (amount: number) => {
    if (amount === 0 || !amount) return '-';
    // Use "BDT" prefix instead of the symbol to ensure compatibility with standard PDF fonts
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
    doc.text(`${contactType === 'vendor' ? 'Vendor' : 'Client'} Statement`, centerX, 22, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(contact.name, centerX, 29, { align: 'center' });

    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`, pageMargins.left, 15);

    let runningBalance = 0;
    const tableData = combinedHistory.map(item => {
        let debit = 0;
        let credit = 0;
        let description = '';

        if (isPaymentInstallment(item)) { // PaymentInstallment
             credit = item.amount;
             runningBalance -= credit;
             description = `Payment for: ${item.originalDescription}`;
        } else { // LedgerTransaction
            if(item.type === 'advance') {
                credit = Math.abs(item.amount);
                runningBalance -= credit;
            } else {
                debit = item.amount;
                runningBalance += item.amount;
            }
            description = item.description;
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
        styles: {
            font: 'Helvetica',
            fontSize: 9,
        },
        headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
        footStyles: {
            fillColor: [236, 240, 241],
            textColor: [44, 62, 80],
            fontStyle: 'bold',
        },
        columnStyles: {
            0: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        },
        didParseCell: function(data: any) {
            // Center align the footer labels
            if (data.section === 'foot') {
                if (data.column.index === 1) {
                    data.cell.styles.halign = 'right';
                }
                if (data.column.index === 2 || data.column.index === 3 || data.column.index === 4) {
                    data.cell.styles.halign = 'right';
                }
                if(data.row.index === 2) { // Balance Due row
                    data.cell.styles.fontSize = 10;
                }
            }
        },
        didDrawPage: (data: any) => {
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                'System Generated Report',
                data.settings.margin.left,
                doc.internal.pageSize.getHeight() - 10
            );
            doc.text(
                `Page ${data.pageNumber}`,
                doc.internal.pageSize.getWidth() - data.settings.margin.right,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'right' }
            );
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
            A complete record of all transactions with this {contactType}.
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
                    {combinedHistory.length > 0 ? (() => {
                        let balance = 0;
                        return combinedHistory.map((item, index) => {
                            let debit = 0;
                            let credit = 0;
                            let description = '';
                            
                            if (isPaymentInstallment(item)) {
                                credit = item.amount;
                                balance -= credit;
                                description = item.originalDescription;
                            } else { // LedgerTransaction
                                if (item.type === 'advance') {
                                    credit = Math.abs(item.amount);
                                    balance -= credit;
                                } else {
                                    debit = item.amount;
                                    balance += debit;
                                }
                                description = item.description;
                            }

                            return (
                                <TableRow key={('id' in item ? item.id : item.createdAt) + index}>
                                    <TableCell className="font-mono">{format(new Date(item.date), 'dd-MM-yy')}</TableCell>
                                    <TableCell>
                                        {isPaymentInstallment(item) ? (
                                            <div className="flex items-center gap-2 text-sm">
                                                <ArrowRight className="h-4 w-4 text-green-500"/>
                                                <span className="text-muted-foreground italic">Payment for:</span>
                                                <span className="italic">{description}</span>
                                            </div>
                                        ) : (
                                           <span className={('type' in item && item.type === 'advance') ? 'text-blue-600' : ''}>{description}</span>
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
                            <TableCell colSpan={5} className="text-center h-24">No transactions found for this {contactType}.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
        <DialogFooter>
          <Button onClick={handleExportPdf}>
              <FileText className="mr-2 h-4 w-4" />
              Export to PDF
          </Button>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
