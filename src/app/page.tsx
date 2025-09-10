
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from './context/app-context';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DashboardTab } from '@/components/dashboard-tab';
import { CashTab } from '@/components/cash-tab';
import { BankTab } from '@/components/bank-tab';
import { StockTab } from '@/components/stock-tab';
import { SettingsTab } from '@/components/settings-tab';
import { CreditTab } from '@/components/credit-tab';
import { LoansTab } from '@/components/loans-tab';
import { InitialBalanceDialog } from '@/components/initial-balance-dialog';
import { FloatingActionButton } from '@/components/floating-action-button';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarProvider, Sidebar, useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Menu } from 'lucide-react';
import { format } from 'date-fns';

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-xl',
};

function MainContent() {
    const { 
        fontSize, isInitialBalanceDialogOpen, user,
        cashTransactions, bankTransactions, isLoading
    } = useAppContext();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentDate, setCurrentDate] = useState('');
    const isAdmin = user?.role === 'admin';
    const { isMobile } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();

    const cashBalance = useMemo(() => 
      (cashTransactions || []).reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0), 
      [cashTransactions]
    );
    
    const bankBalance = useMemo(() => 
      (bankTransactions || []).reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0),
      [bankTransactions]
    );
    
    useEffect(() => {
        if (isLoading) return; // Don't redirect while initial loading is in progress.
        const onLoginPage = pathname === '/login';
        if (user && onLoginPage) {
            router.replace('/');
        } else if (!user && !onLoginPage) {
            router.replace('/login');
        }
    }, [user, isLoading, pathname, router]);

    useEffect(() => {
        setCurrentDate(format(new Date(), 'PPP'));
    }, []);

    if (!user) {
        return null; // Should be handled by the layout effect, but as a fallback
    }

    const renderTabContent = (tab: string) => {
        switch (tab) {
            case 'dashboard': return <DashboardTab 
                                        setActiveTab={setActiveTab} 
                                        cashBalance={cashBalance}
                                        bankBalance={bankBalance}
                                    />;
            case 'cash': return <CashTab />;
            case 'bank': return <BankTab />;
            case 'credit': return <CreditTab />;
            case 'stock': return <StockTab />;
            case 'loans': return <LoansTab />;
            case 'settings': return <SettingsTab />;
            default: return <DashboardTab 
                                setActiveTab={setActiveTab} 
                                cashBalance={cashBalance}
                                bankBalance={bankBalance}
                            />;
        }
    }

    return (
        <div className={cn('min-h-screen bg-background text-foreground flex', fontClasses[fontSize] || 'text-base')}>
            {isAdmin && <InitialBalanceDialog isOpen={isInitialBalanceDialogOpen} />}
            
            <Sidebar>
                <AppSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            </Sidebar>
            
            <main className="flex-1 flex flex-col transition-all duration-300 ease-in-out md:ml-14 peer-hover/sidebar:md:ml-64">
                {isMobile && (
                    <header className="flex items-center p-2 border-b">
                         <SidebarTrigger className="ml-2">
                            <Menu className="h-6 w-6" />
                         </SidebarTrigger>
                         <div className="ml-4">
                            <h1 className="text-xl font-semibold leading-tight">Ha-Mim Iron Mart</h1>
                            <p className="text-xs text-muted-foreground">{currentDate}</p>
                        </div>
                    </header>
                )}
                <div className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                        >
                            {renderTabContent(activeTab)}
                        </motion.div>
                    </AnimatePresence>
                </div>
                {isAdmin && <FloatingActionButton />}
            </main>
        </div>
    )
}


export default function Home() {
  return (
    <SidebarProvider>
        <MainContent />
    </SidebarProvider>
  );
}
