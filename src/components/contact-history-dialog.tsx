
"use client";

import { useMemo } from "react";
import { useAppContext } from "@/app/store";
import type { Vendor, Client, LedgerTransaction, PaymentInstallment } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFoot } from "./ui/table";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import { Button } from "./ui/button";
import { FileText, ArrowRight } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from "@/hooks/use-toast";

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

export function ContactHistoryDialog({ isOpen, setIsOpen, contact, contactType }: ContactHistoryDialogProps) {
  const { ledgerTransactions, currency } = useAppContext();
  const { toast } = useToast();

  const transactions = useMemo(() => {
    return ledgerTransactions
        .filter(tx => tx.contact_id === contact.id)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [ledgerTransactions, contact.id]);

  const combinedHistory = useMemo(() => {
    const history: (LedgerTransaction | (PaymentInstallment & { originalDescription: string }))[] = [];
    transactions.forEach(tx => {
        history.push(tx);
        (tx.installments || []).forEach(inst => {
            history.push({ ...inst, originalDescription: tx.description });
        });
    });
    return history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);


  const { totalDebit, totalCredit, finalBalance } = useMemo(() => {
    let debit = 0;
    let credit = 0;
    transactions.forEach(tx => {
        debit += tx.amount;
        credit += tx.paid_amount;
    });
    return { totalDebit: debit, totalCredit: credit, finalBalance: debit - credit };
  }, [transactions]);


  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const formatCurrencyForPdf = (amount: number) => {
    if (amount === 0) return '-';
    const prefix = currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : currency === 'INR' ? '₹' : '';
    return `${prefix} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageMargins = { top: 20, right: 15, bottom: 20, left: 15 };
    const centerX = doc.internal.pageSize.getWidth() / 2;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("Ha-Mim Iron Mart", centerX, 15, { align: 'center' });
    
    doc.setFont('Helvetica', 'normal');
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

        if ('type' in item) { // LedgerTransaction
            debit = item.amount;
            runningBalance += item.amount;
            description = item.description;
        } else { // PaymentInstallment
            credit = item.amount;
            runningBalance -= item.amount;
            description = `Payment for: ${item.originalDescription}`;
        }

        return [
            format(new Date(item.date), 'dd-MM-yy'),
            description,
            formatCurrencyForPdf(debit),
            formatCurrencyForPdf(credit),
            formatCurrencyForPdf(runningBalance),
        ]
    });

    doc.autoTable({
        startY: 35,
        head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            2: { halign: 'right', font: 'Courier' },
            3: { halign: 'right', font: 'Courier' },
            4: { halign: 'right', font: 'Courier', fontStyle: 'bold' },
        },
        didDrawPage: (data) => {
            // Footer
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
    toast({ title: "PDF Exported", description: `Statement for ${contact.name} has been saved.`});
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
        <div className="max-h-[60vh] overflow-y-auto pr-4">
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
                        return combinedHistory.map(item => {
                            let debit = 0;
                            let credit = 0;
                            let description = '';
                            let isInstallment = false;

                            if ('type' in item) { // LedgerTransaction
                                debit = item.amount;
                                balance += item.amount;
                                description = item.description;
                            } else { // PaymentInstallment
                                credit = item.amount;
                                balance -= item.amount;
                                description = item.originalDescription;
                                isInstallment = true;
                            }

                            return (
                                <TableRow key={'id' in item ? item.id : item.createdAt}>
                                    <TableCell className="font-mono">{format(new Date(item.date), 'dd-MM-yy')}</TableCell>
                                    <TableCell>
                                        {isInstallment && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <ArrowRight className="h-4 w-4 text-green-500"/>
                                                <span className="text-muted-foreground">Payment for:</span>
                                                <span>{description}</span>
                                            </div>
                                        )}
                                        {!isInstallment && <span>{description}</span>}
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
                 {transactions.length > 0 && (
                    <TableFoot>
                        <TableRow>
                            <TableCell colSpan={4} className="text-right font-bold">Total Debit</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatCurrency(totalDebit)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell colSpan={4} className="text-right font-bold">Total Credit</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(totalCredit)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                            <TableCell colSpan={4} className="text-right font-bold text-lg">Balance Due</TableCell>
                            <TableCell className="text-right font-bold font-mono text-lg">{formatCurrency(finalBalance)}</TableCell>
                        </TableRow>
                    </TableFoot>
                 )}
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

