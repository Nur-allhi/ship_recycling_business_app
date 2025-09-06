
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
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-xl',
};

function ShipShapeLedger() {
  const { fontSize, isInitialBalanceDialogOpen, user } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const isAdmin = user?.role === 'admin';

  if (!user) {
    return <AppLoading message="Please wait..." />;
  }
  
  const roleDisplayName = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';

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
    <SidebarProvider>
        <div className={cn('min-h-screen bg-background text-foreground', fontClasses[fontSize] || 'text-base')}>
            {isAdmin && <InitialBalanceDialog isOpen={isInitialBalanceDialogOpen} />}
            
            <Sidebar>
                <AppSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            </Sidebar>

            <SidebarInset className="flex flex-col min-h-screen">
                <main className="flex-grow p-4 md:p-6 lg:p-8">
                     <div className="flex items-center gap-2 mb-4">
                        <SidebarTrigger />
                        <h2 className="text-lg font-semibold text-muted-foreground">
                            Welcome, {user.username} ({roleDisplayName})
                        </h2>
                    </div>
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
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}

export default function Home() {
  return (
    <ShipShapeLedger />
  );
}
