
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
import Logo from '@/components/logo';

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

            <SidebarInset>
                 <div className="container mx-auto p-4 md:p-6 lg:p-8">
                    <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2 w-full">
                             <SidebarTrigger className="md:hidden"/>
                             <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <Logo className="h-10 w-10 text-primary hidden sm:block" />
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl font-bold text-primary">
                                        Ha-Mim Iron Mart
                                        </h1>
                                    </div>
                                </div>
                                <p className="text-muted-foreground text-sm sm:text-base">
                                Welcome {roleDisplayName}
                                </p>
                            </div>
                        </div>
                    </header>
                    <main>
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
