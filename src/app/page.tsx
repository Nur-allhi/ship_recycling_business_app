
"use client";

import { useState, useMemo } from 'react';
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
    const { 
        fontSize, isInitialBalanceDialogOpen, user, isLoading, isInitialLoadComplete,
        cashTransactions, bankTransactions, stockItems, stockTransactions, showStockValue
    } = useAppContext();
    const [activeTab, setActiveTab] = useState('dashboard');
    const isAdmin = user?.role === 'admin';
    const { state, setOpen } = useSidebar();

    const cashBalance = useMemo(() => 
      (cashTransactions || []).reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0), 
      [cashTransactions]
    );
    
    const bankBalance = useMemo(() => 
      (bankTransactions || []).reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0),
      [bankTransactions]
    );

    const { currentStockWeight, currentStockValue } = useMemo(() => {
      const portfolio: Record<string, { weight: number, totalValue: number }> = {};
      
      (stockItems || []).forEach(item => {
          if (!portfolio[item.name]) {
              portfolio[item.name] = { weight: 0, totalValue: 0 };
          }
          portfolio[item.name].weight += item.weight;
          portfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
      });

      const allTransactions = [...(stockTransactions || [])].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      allTransactions.forEach(tx => {
          if (!portfolio[tx.stockItemName]) {
              portfolio[tx.stockItemName] = { weight: 0, totalValue: 0 };
          }
          
          const item = portfolio[tx.stockItemName];
          const currentAvgPrice = item.weight > 0 ? item.totalValue / item.weight : 0;

          if (tx.type === 'purchase') {
              item.weight += tx.weight;
              item.totalValue += tx.weight * tx.pricePerKg;
          } else { // Sale
              item.weight -= tx.weight;
              item.totalValue -= tx.weight * currentAvgPrice;
          }
      });
      
      let totalWeight = 0;
      let totalValue = 0;
      Object.values(portfolio).forEach(item => {
          totalWeight += item.weight;
          totalValue += item.totalValue;
      });
      
      return {
        currentStockWeight: totalWeight,
        currentStockValue: totalValue
      };
    }, [stockItems, stockTransactions]);

    if (isLoading || !isInitialLoadComplete || !user) {
        return <AppLoading message="Please wait..." />;
    }

    const renderTabContent = (tab: string) => {
        switch (tab) {
            case 'dashboard': return <DashboardTab 
                                        setActiveTab={setActiveTab} 
                                        cashBalance={cashBalance}
                                        bankBalance={bankBalance}
                                        currentStockWeight={currentStockWeight}
                                        currentStockValue={currentStockValue}
                                        isLoading={isLoading}
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
                                currentStockWeight={currentStockWeight}
                                currentStockValue={currentStockValue}
                                isLoading={isLoading}
                            />;
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
