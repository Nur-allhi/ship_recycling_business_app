
"use client";

import { useState } from 'react';
import { useAppContext } from './context/app-context';
import { cn } from '@/lib/utils';
import { DashboardTab } from '@/components/dashboard-tab';
import { CashTab } from '@/components/cash-tab';
import { BankTab } from '@/components/bank-tab';
import { StockTab } from '@/components/stock-tab';
import { SettingsTab } from '@/components/settings-tab';
import { CreditTab } from '@/components/credit-tab';
import { LoansTab } from '@/components/loans-tab';
import { InitialBalanceDialog } from '@/components/initial-balance-dialog';
import { AppLoading } from '@/components/app-loading';
import { FloatingActionButton } from '@/components/floating-action-button';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarProvider, Sidebar, useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import LogoutOverlayWrapper from '@/components/logout-overlay-wrapper';

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-xl',
};

function MainContent() {
    const { fontSize, isInitialBalanceDialogOpen, user, isLoading, isInitialLoadComplete } = useAppContext();
    const [activeTab, setActiveTab] = useState('dashboard');
    const isAdmin = user?.role === 'admin';
    const { state, setOpen } = useSidebar();

    if (isLoading || !isInitialLoadComplete || !user) {
        return <AppLoading message="Please wait..." />;
    }

    const renderTabContent = (tab: string) => {
        switch (tab) {
            case 'dashboard': return <DashboardTab setActiveTab={setActiveTab} />;
            case 'cash': return <CashTab />;
            case 'bank': return <BankTab />;
            case 'credit': return <CreditTab />;
            case 'stock': return <StockTab />;
            case 'loans': return <LoansTab />;
            case 'settings': return <SettingsTab />;
            default: return <DashboardTab setActiveTab={setActiveTab} />;
        }
    }

    return (
        <div className={cn('min-h-screen bg-background text-foreground flex', fontClasses[fontSize] || 'text-base')}>
            <LogoutOverlayWrapper />
            {isAdmin && <InitialBalanceDialog isOpen={isInitialBalanceDialogOpen} />}
            
            <Sidebar onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
                <AppSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            </Sidebar>
            
            <div 
              className={cn(
                "flex-1 flex flex-col transition-all duration-300 ease-in-out",
                state === 'collapsed' ? 'md:ml-12' : 'md:ml-64'
              )}
            >
                <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto">
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
                </main>
                {isAdmin && <FloatingActionButton />}
            </div>
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
