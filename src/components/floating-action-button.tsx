"use client";

import { useState, lazy, Suspense, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Plus, X, Wallet, Landmark, Boxes, ArrowRightLeft, UserPlus, Handshake, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from './ui/drawer';

const CashForm = lazy(() => import('./forms/cash-form').then(m => ({ default: m.CashForm })));
const BankForm = lazy(() => import('./forms/bank-form').then(m => ({ default: m.BankForm })));
const StockForm = lazy(() => import('./forms/stock-form').then(m => ({ default: m.StockForm })));
const TransferForm = lazy(() => import('./forms/transfer-form').then(m => ({ default: m.TransferForm })));
const ApArForm = lazy(() => import('./forms/ap-ar-form').then(m => ({ default: m.ApArForm })));
const LoanForm = lazy(() => import('./forms/loan-form').then(m => ({ default: m.LoanForm })));

type TransactionType = 'cash' | 'bank' | 'stock' | 'transfer' | 'ap_ar' | 'loan';

const fabActions = [
    { type: 'loan' as TransactionType, icon: Handshake, label: 'Add Loan', title: 'New Loan Agreement', description: 'Record a new loan payable or receivable.' },
    { type: 'ap_ar' as TransactionType, icon: UserPlus, label: 'A/R & A/P', title: 'New A/R or A/P Entry', description: 'Record a new payable or receivable item.' },
    { type: 'transfer' as TransactionType, icon: ArrowRightLeft, label: 'Transfer', title: 'Transfer Funds', description: 'Move money between your cash and bank accounts.' },
    { type: 'stock' as TransactionType, icon: Boxes, label: 'Stock Transaction', title: 'Stock Transaction', description: 'Record a stock purchase or sale.' },
    { type: 'bank' as TransactionType, icon: Landmark, label: 'Bank', title: 'New Bank Transaction', description: 'Record a new deposit or withdrawal from a bank account.' },
    { type: 'cash' as TransactionType, icon: Wallet, label: 'Cash', title: 'New Cash Transaction', description: 'Record a new income or expense using cash.' },
];

export function FloatingActionButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedForm, setSelectedForm] = useState<TransactionType | null>(null);
    const isMobile = useIsMobile();
    const fabRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleActionClick = (type: TransactionType) => {
        setSelectedForm(type);
        setIsDialogOpen(true);
        setIsOpen(false);
    };

    const renderForm = () => {
        switch (selectedForm) {
            case 'cash': return <CashForm setDialogOpen={setIsDialogOpen} />;
            case 'bank': return <BankForm setDialogOpen={setIsDialogOpen} />;
            case 'stock': return <StockForm setDialogOpen={setIsDialogOpen} />;
            case 'transfer': return <TransferForm setDialogOpen={setIsDialogOpen} />;
            case 'ap_ar': return <ApArForm setDialogOpen={setIsDialogOpen} />;
            case 'loan': return <LoanForm setDialogOpen={setIsDialogOpen} />;
            default: return null;
        }
    };
    
    const DialogComponent = isMobile ? Drawer : Dialog;
    const DialogContentComponent = isMobile ? DrawerContent : DialogContent;
    const activeAction = fabActions.find(a => a.type === selectedForm);

    return (
        <>
            <div className="fixed bottom-6 right-6 z-40" ref={fabRef}>
                <div className="relative flex flex-col items-end gap-2">
                    <AnimatePresence>
                        {isOpen && fabActions.map((action, index) => (
                            <motion.div
                                key={action.type}
                                initial={{ opacity: 0, y: 10 * (index + 1) }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 * (index + 1) }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                className="flex items-center justify-end gap-2 w-48"
                            >
                                <span className="bg-card text-card-foreground text-sm px-3 py-1 rounded-md shadow-lg w-full text-center">{action.label}</span>
                                <Button
                                    size="sm"
                                    className="rounded-full w-12 h-12 shadow-lg"
                                    onClick={() => handleActionClick(action.type)}
                                >
                                    <action.icon className="h-5 w-5" />
                                </Button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    <Button
                        size="lg"
                        className="rounded-full w-16 h-16 shadow-xl relative"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <AnimatePresence initial={false}>
                            <motion.div
                                key={isOpen ? 'x' : 'plus'}
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: 45 }}
                                transition={{ duration: 0.2 }}
                                className="absolute"
                            >
                                {isOpen ? <X className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
                            </motion.div>
                        </AnimatePresence>
                    </Button>
                </div>
            </div>

            <DialogComponent open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContentComponent className="sm:max-w-xl p-0 overflow-hidden flex flex-col h-[90dvh]">
                    <DialogHeader className="p-4 sm:p-6 pb-0 text-left shrink-0">
                      {activeAction && <DialogTitle>{activeAction.title}</DialogTitle>}
                      {activeAction && <DialogDescription>{activeAction.description}</DialogDescription>}
                    </DialogHeader>
                    <div className="flex-grow overflow-y-auto">
                        <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
                            {renderForm()}
                        </Suspense>
                    </div>
                </DialogContentComponent>
            </DialogComponent>
        </>
    );
}
