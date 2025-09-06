
"use client";

import { useState } from 'react';
import { useAppContext } from './context/app-context';
import { cn } from '@/lib/utils';
import { Wallet, Landmark, Boxes, Settings, LogOut, CreditCard, LineChart, Handshake } from 'lucide-react';
import { DashboardTab } from '@/components/dashboard-tab';
import { CashTab } from '@/components/cash-tab';
import { BankTab } from '@/components/bank-tab';
import { StockTab } from '@/components/stock-tab';
import { SettingsTab } from '@/components/settings-tab';
import { CreditTab } from '@/components/credit-tab';
import { LoansTab } from '@/components/loans-tab';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { InitialBalanceDialog } from '@/components/initial-balance-dialog';
import Logo from '@/components/logo';
import { AppLoading } from '@/components/app-loading';
import { FloatingActionButton } from '@/components/floating-action-button';
import { AnimatePresence, motion } from 'framer-motion';

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-xl',
};

const navItems = [
    { value: 'dashboard', label: 'Dashboard', icon: LineChart },
    { value: 'cash', label: 'Cash', icon: Wallet },
    { value: 'bank', label: 'Bank', icon: Landmark },
    { value: 'credit', label: 'A/R & A/P', icon: CreditCard },
    { value: 'stock', label: 'Stock', icon: Boxes },
    { value: 'loans', label: 'Loans', icon: Handshake },
    { value: 'settings', label: 'Settings', icon: Settings },
]

function ShipShapeLedger() {
  const { fontSize, isInitialBalanceDialogOpen, user, logout } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (isMobile) {
      setIsSheetOpen(false);
    }
  };

  const roleDisplayName = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
  
  if (!user) {
    return <AppLoading message="Please wait..." />;
  }
  
  const renderTabContent = () => {
    return (
        <div className="mt-6">
            <AnimatePresence mode="wait">
                <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}
                >
                    <DashboardTab setActiveTab={setActiveTab} />
                </motion.div>
                <motion.div
                    key="cash"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                     style={{ display: activeTab === 'cash' ? 'block' : 'none' }}
                >
                    <CashTab />
                </motion.div>
                 <motion.div
                    key="bank"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                     style={{ display: activeTab === 'bank' ? 'block' : 'none' }}
                >
                    <BankTab />
                </motion.div>
                <motion.div
                    key="credit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                     style={{ display: activeTab === 'credit' ? 'block' : 'none' }}
                >
                    <CreditTab />
                </motion.div>
                <motion.div
                    key="stock"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                     style={{ display: activeTab === 'stock' ? 'block' : 'none' }}
                >
                    <StockTab />
                </motion.div>
                 <motion.div
                    key="loans"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                     style={{ display: activeTab === 'loans' ? 'block' : 'none' }}
                >
                    <LoansTab />
                </motion.div>
                <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                     style={{ display: activeTab === 'settings' ? 'block' : 'none' }}
                >
                    <SettingsTab />
                </motion.div>
            </AnimatePresence>
        </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-background text-foreground animate-fade-in', fontClasses[fontSize] || 'text-base')}>
      {isAdmin && <InitialBalanceDialog isOpen={isInitialBalanceDialogOpen} />}
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 w-full">
            {isMobile && (
                 <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Logo className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-4 flex flex-col">
                        <SheetHeader>
                           <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                           <SheetDescription className="sr-only">Select a tab to view your financial data.</SheetDescription>
                        </SheetHeader>
                         <div onClick={() => handleTabChange('dashboard')} className="flex items-center gap-3 mb-6 cursor-pointer">
                            <Logo className="h-8 w-8 text-primary" />
                            <h1 className="text-xl font-bold text-primary">
                                Ha-Mim Iron Mart
                            </h1>
                        </div>
                        <nav className="flex flex-col gap-1 flex-1">
                            {navItems.map(item => {
                                const Icon = item.icon;
                                return (
                                <Button 
                                    key={item.value} 
                                    variant={activeTab === item.value ? "secondary" : "ghost"}
                                    className="justify-start rounded-full"
                                    onClick={() => handleTabChange(item.value)}
                                >
                                    <Icon className="mr-2 h-4 w-4" />
                                    {item.label}
                                </Button>
                                )
                            })}
                        </nav>
                        <Button variant="ghost" onClick={(e) => { 
    e.preventDefault(); 
    setIsSheetOpen(false);
    setTimeout(() => {
        logout(); 
    }, 100);
}} className="justify-start">
                            <LogOut className="mr-2 h-4 w-4" /> Logout
                        </Button>
                    </SheetContent>
                </Sheet>
            )}
            <div className="flex-1">
                <div onClick={() => handleTabChange('dashboard')} className="flex items-center gap-3 mb-1 cursor-pointer">
                  {!isMobile && <Logo className="h-10 w-10 text-primary" />}
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
          <div className="flex items-center gap-2">
            {!isMobile && <Button variant="outline" onClick={logout} size="sm"><LogOut className="mr-2 h-4 w-4" />Logout</Button>}
          </div>
        </header>
        <main>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
             {!isMobile && (
                <div className="overflow-x-auto pb-2">
                    <TabsList>
                        {navItems.map(item => {
                            const Icon = item.icon;
                            return (
                            <TabsTrigger key={item.value} value={item.value}>
                                <Icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </TabsTrigger>
                            )
                        })}
                    </TabsList>
                </div>
             )}
             {renderTabContent()}
          </Tabs>
        </main>
        {isAdmin && <FloatingActionButton />}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ShipShapeLedger />
  );
}
