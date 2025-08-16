
"use client";

import { useMemo } from "react";
import { useAppContext } from "@/app/store";
import type { Vendor, Client, LedgerTransaction } from "@/lib/types";
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
import { FileText } from "lucide-react";
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
        .filter(tx => tx.contact === contact.name)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [ledgerTransactions, contact.name]);

  const { totalDebit, totalCredit, finalBalance } = useMemo(() => {
    let balance = 0;
    let debit = 0;
    let credit = 0;
    transactions.forEach(tx => {
        if (contactType === 'vendor') { // Payable
            balance += tx.amount;
            debit += tx.amount;
            if(tx.status === 'paid') {
                balance -= tx.amount;
                credit += tx.amount;
            }
        } else { // Receivable
            balance += tx.amount;
            debit += tx.amount;
            if (tx.status === 'paid') {
                balance -= tx.amount;
                credit += tx.amount;
            }
        }
    });
    return { totalDebit: debit, totalCredit: credit, finalBalance: balance };
  }, [transactions, contactType]);


  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }
  
  const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageMargins = { top: 20, right: 15, bottom: 20, left: 15 };
    const centerX = doc.internal.pageSize.getWidth() / 2;

    // Header
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
    const tableData = transactions.map(tx => {
        const isPayable = tx.type === 'payable';
        const isReceivable = tx.type === 'receivable';
        const isPaid = tx.status === 'paid';

        let debit = 0;
        let credit = 0;
        
        // For a vendor, a payable is a debit, a payment is a credit
        // For a client, a receivable is a debit, a payment is a credit
        if (isPayable || isReceivable) {
            debit = tx.amount;
            runningBalance += tx.amount;
        }
        if (isPaid) {
            credit = tx.amount;
            runningBalance -= tx.amount;
        }

        return [
            format(new Date(tx.date), 'dd-MM-yy'),
            tx.description,
            isPaid ? format(new Date(tx.paidDate!), 'dd-MM-yy') : '-',
            formatCurrency(debit),
            formatCurrency(credit),
            formatCurrency(runningBalance),
        ]
    });

    doc.autoTable({
        startY: 35,
        head: [['Date', 'Description', 'Paid Date', 'Debit', 'Credit', 'Balance']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' },
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
                        <TableHead>Status</TableHead>
                        <TableHead>Paid On</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {transactions.length > 0 ? (
                        transactions.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell className="font-mono">{format(new Date(tx.date), 'dd-MM-yy')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell>
                                    <Badge variant={tx.status === 'paid' ? 'default' : 'destructive'} className="capitalize bg-opacity-20 text-opacity-100">{tx.status}</Badge>
                                </TableCell>
                                <TableCell className="font-mono">{tx.paidDate ? format(new Date(tx.paidDate), 'dd-MM-yy') : '-'}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">{formatCurrency(tx.amount)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
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
                            <TableCell className="text-right font-bold font-mono">{formatCurrency(totalCredit)}</TableCell>
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
    