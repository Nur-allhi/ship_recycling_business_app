
"use client";

import { useMemo, useEffect, useState } from "react";
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
import { FileText, ArrowRight, Loader2, Printer } from "lucide-react";
import { toast } from 'sonner';
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useAppContext } from "@/app/context/app-context";
import { generateContactStatementPdf } from "@/lib/pdf-utils";

interface ContactHistoryDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  contact: Contact;
}

type CombinedHistoryItem = (LedgerTransaction & { itemType: 'ledger' }) | ((CashTransaction | BankTransaction) & { itemType: 'payment' });

export function ContactHistoryDialog({ isOpen, setIsOpen, contact }: ContactHistoryDialogProps) {
  const { currency } = useAppContext();
  const ledgerTransactions = useLiveQuery(() => db.ap_ar_transactions.where('contact_id').equals(contact.id).toArray(), [contact.id]);
  const cashTransactions = useLiveQuery(() => db.cash_transactions.where('contact_id').equals(contact.id).toArray(), [contact.id]);
  const bankTransactions = useLiveQuery(() => db.bank_transactions.where('contact_id').equals(contact.id).toArray(), [contact.id]);

  const [isLoading, setIsLoading] = useState(true);
  const [combinedHistory, setCombinedHistory] = useState<CombinedHistoryItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    if (ledgerTransactions === undefined || cashTransactions === undefined || bankTransactions === undefined) {
      setIsLoading(true);
      return;
    }
    
    setIsLoading(true);

    const arApTxs: CombinedHistoryItem[] = (ledgerTransactions || [])
      .map(tx => ({ ...tx, itemType: 'ledger' }));

    const relevantCashTxs: CombinedHistoryItem[] = (cashTransactions || [])
      .filter(tx => tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement')
      .map(tx => ({ ...tx, itemType: 'payment' }));

    const relevantBankTxs: CombinedHistoryItem[] = (bankTransactions || [])
      .filter(tx => tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement')
      .map(tx => ({ ...tx, itemType: 'payment' }));
      
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
             } else if (item.type === 'receivable') { 
                debit += item.amount;
             } else if (item.type === 'payable') { 
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

    const finalDebit = contact.type === 'vendor' ? credit : debit;
    const finalCredit = contact.type === 'vendor' ? debit : credit;

    return { totalDebit: debit, totalCredit: credit, finalBalance: debit - credit };
  }, [combinedHistory, contact.type]);


  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  const handleExportPdf = () => {
    generateContactStatementPdf(contact, combinedHistory, currency, totalDebit, totalCredit, finalBalance);
  };


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
              <Printer className="mr-2 h-4 w-4" />
              Export Statement
          </Button>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
