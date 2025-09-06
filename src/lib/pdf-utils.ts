
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { CashTransaction, BankTransaction, StockTransaction } from '@/lib/types';
import { toast } from 'sonner';

// Extend the jsPDF interface to include autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

const generateHeader = (doc: jsPDF, title: string, date: Date) => {
    const pageMargins = { left: 15, right: 15, top: 20, bottom: 20 };
    const centerX = doc.internal.pageSize.getWidth() / 2;

    doc.setFontSize(18);
    doc.text("Ha-Mim Iron Mart", centerX, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(title, centerX, 22, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Report for: ${format(date, 'MMMM yyyy')}`, pageMargins.left, 15);
    doc.text(`Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`, pageMargins.left, 20);
};

const generateFooter = (doc: jsPDF) => {
    const pageCount = doc.internal.pages.length - 1;
    const pageMargins = { left: 15, right: 15 };
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('System Generated Report', pageMargins.left, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - pageMargins.right, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }
};

const formatCurrencyForPdf = (amount: number, currency: string) => {
    if (amount === 0 || !amount) return '-';
    const prefix = currency === 'BDT' ? 'BDT' : currency; 
    return `${prefix} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const generateCashLedgerPdf = (transactions: CashTransaction[], month: Date, currency: string, closingBalance: number) => {
    try {
        const doc = new jsPDF();
        generateHeader(doc, 'Cash Ledger', month);
        
        const openingBalance = transactions.reduce((acc, tx) => acc - (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), closingBalance);
        const totalIncome = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.actual_amount, 0);
        const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.actual_amount, 0);

        const summaryData = [
            ['Opening Balance:', formatCurrencyForPdf(openingBalance, currency)],
            ['Total Income:', formatCurrencyForPdf(totalIncome, currency)],
            ['Total Expense:', formatCurrencyForPdf(totalExpense, currency)],
            ['Closing Balance:', formatCurrencyForPdf(closingBalance, currency)],
        ];

        doc.autoTable({
            body: summaryData,
            startY: 28,
            theme: 'plain',
            styles: { fontSize: 9, fontStyle: 'bold' }
        });

        const tableData = transactions.map(tx => [
            format(new Date(tx.date), 'dd-MM-yy'),
            tx.description,
            tx.category,
            tx.type === 'expense' ? formatCurrencyForPdf(tx.actual_amount, currency) : '-',
            tx.type === 'income' ? formatCurrencyForPdf(tx.actual_amount, currency) : '-',
            formatCurrencyForPdf((tx as any).balance, currency)
        ]);
        
        doc.autoTable({
            head: [['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance']],
            body: tableData,
            startY: (doc as any).lastAutoTable.finalY + 5,
            theme: 'grid',
            headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }},
        });
        
        generateFooter(doc);
        doc.save(`cash_ledger_${format(month, 'yyyy-MM')}.pdf`);
        toast.success("PDF Exported", { description: "Cash ledger has been saved."});
    } catch (e) {
        toast.error("PDF Export Failed", { description: "An unexpected error occurred." });
        console.error(e);
    }
};

export const generateBankLedgerPdf = (transactions: BankTransaction[], month: Date, currency: string, closingBalance: number, bankName: string) => {
     try {
        const doc = new jsPDF();
        generateHeader(doc, `Bank Ledger - ${bankName}`, month);
        
        const openingBalance = transactions.reduce((acc, tx) => acc - (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), closingBalance);
        const totalDeposit = transactions.filter(tx => tx.type === 'deposit').reduce((sum, tx) => sum + tx.actual_amount, 0);
        const totalWithdrawal = transactions.filter(tx => tx.type === 'withdrawal').reduce((sum, tx) => sum + tx.actual_amount, 0);

        const summaryData = [
            ['Opening Balance:', formatCurrencyForPdf(openingBalance, currency)],
            ['Total Deposits:', formatCurrencyForPdf(totalDeposit, currency)],
            ['Total Withdrawals:', formatCurrencyForPdf(totalWithdrawal, currency)],
            ['Closing Balance:', formatCurrencyForPdf(closingBalance, currency)],
        ];

        doc.autoTable({
            body: summaryData,
            startY: 28,
            theme: 'plain',
            styles: { fontSize: 9, fontStyle: 'bold' }
        });

        const tableData = transactions.map(tx => [
            format(new Date(tx.date), 'dd-MM-yy'),
            tx.description,
            tx.category,
            tx.type === 'withdrawal' ? formatCurrencyForPdf(tx.actual_amount, currency) : '-',
            tx.type === 'deposit' ? formatCurrencyForPdf(tx.actual_amount, currency) : '-',
            formatCurrencyForPdf((tx as any).balance, currency)
        ]);
        
        doc.autoTable({
            head: [['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance']],
            body: tableData,
            startY: (doc as any).lastAutoTable.finalY + 5,
            theme: 'grid',
            headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }},
        });
        
        generateFooter(doc);
        doc.save(`bank_ledger_${bankName.replace(/ /g, '_')}_${format(month, 'yyyy-MM')}.pdf`);
        toast.success("PDF Exported", { description: "Bank ledger has been saved."});
    } catch (e) {
        toast.error("PDF Export Failed", { description: "An unexpected error occurred." });
        console.error(e);
    }
};

export const generateStockLedgerPdf = (transactions: StockTransaction[], month: Date, currency: string) => {
    try {
        const doc = new jsPDF();
        generateHeader(doc, 'Stock Ledger', month);
        
        const totalPurchaseValue = transactions.filter(tx => tx.type === 'purchase').reduce((sum, tx) => sum + tx.actual_amount, 0);
        const totalSaleValue = transactions.filter(tx => tx.type === 'sale').reduce((sum, tx) => sum + tx.actual_amount, 0);

        doc.autoTable({
            body: [
                ['Total Purchases:', formatCurrencyForPdf(totalPurchaseValue, currency)],
                ['Total Sales:', formatCurrencyForPdf(totalSaleValue, currency)],
            ],
            startY: 28,
            theme: 'plain',
            styles: { fontSize: 9, fontStyle: 'bold' }
        });

        const tableData = transactions.map(tx => [
            format(new Date(tx.date), 'dd-MM-yy'),
            tx.stockItemName,
            tx.type,
            `${tx.weight.toFixed(2)} kg`,
            formatCurrencyForPdf(tx.pricePerKg, currency),
            formatCurrencyForPdf(tx.actual_amount, currency),
        ]);
        
        doc.autoTable({
            head: [['Date', 'Item', 'Type', 'Weight', 'Price/kg', 'Total Value']],
            body: tableData,
            startY: (doc as any).lastAutoTable.finalY + 5,
            theme: 'grid',
            headStyles: { fillColor: [34, 49, 63], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }},
        });
        
        generateFooter(doc);
        doc.save(`stock_ledger_${format(month, 'yyyy-MM')}.pdf`);
        toast.success("PDF Exported", { description: "Stock ledger has been saved."});
    } catch (e) {
        toast.error("PDF Export Failed", { description: "An unexpected error occurred." });
        console.error(e);
    }
}

    