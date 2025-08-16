"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from './store';
import { cn } from '@/lib/utils';
import { Wallet, Landmark, Boxes, Settings, PlusCircle, LogOut, CreditCard } from 'lucide-react';
import { DashboardTab } from '@/components/dashboard-tab';
import { CashTab } from '@/components/cash-tab';
import { BankTab } from '@/components/bank-tab';
import { StockTab } from '@/components/stock-tab';
import { SettingsTab } from '@/components/settings-tab';
import { CreditTab } from '@/components/credit-tab';
import { UnifiedTransactionForm } from '@/components/unified-transaction-form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { InitialBalanceDialog } from '@/components/initial-balance-dialog';
import Logo from '@/components/logo';

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-xl',
};

const navItems = [
    { value: 'dashboard', label: 'Dashboard', icon: Wallet },
    { value: 'cash', label: 'Cash', icon: Wallet },
    { value: 'bank', label: 'Bank', icon: Landmark },
    { value: 'credit', label: 'Credit', icon: CreditCard },
    { value: 'stock', label: 'Stock', icon: Boxes },
    { value: 'settings', label: 'Settings', icon: Settings },
]

function ShipShapeLedger() {
  const { fontSize, initialBalanceSet, needsInitialBalance, user, logout } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if(isMobile) {
        setIsSheetOpen(false);
    }
  }

  // This check ensures we show a loading screen while the user session is being validated.
  // `initialBalanceSet` is now a proxy for "is the app ready to render?"
  if (!initialBalanceSet) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
            <Logo className="h-16 w-16 text-primary animate-pulse" />
            <p className="text-muted-foreground">Loading your ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-background text-foreground animate-fade-in', fontClasses[fontSize] || 'text-base')}>
      {isAdmin && <InitialBalanceDialog isOpen={needsInitialBalance} />}
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
                         <div className="flex items-center gap-3 mb-6">
                            <Logo className="h-8 w-8 text-primary" />
                            <h1 className="text-xl font-bold text-primary font-headline">
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
                        <Button variant="ghost" onClick={logout} className="justify-start">
                            <LogOut className="mr-2 h-4 w-4" /> Logout
                        </Button>
                    </SheetContent>
                </Sheet>
            )}
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  {!isMobile && <Logo className="h-10 w-10 text-primary" />}
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-primary font-headline">
                      Ha-Mim Iron Mart
                    </h1>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Welcome, {user?.username} ({user?.role})
                </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto flex-shrink-0"><PlusCircle className="mr-2 h-4 w-4" /> Add Transaction</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                    <UnifiedTransactionForm setDialogOpen={setIsDialogOpen}/>
                </DialogContent>
              </Dialog>
            )}
            {!isMobile && <Button variant="outline" onClick={logout} size="sm"><LogOut className="mr-2 h-4 w-4" />Logout</Button>}
          </div>
        </header>
        <main>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
             {!isMobile && (
                <div className="overflow-x-auto pb-2">
                    <TabsList className="grid w-full grid-cols-6 min-w-[700px]">
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
            <TabsContent value="dashboard" className="mt-6 animate-slide-in-up">
              <DashboardTab setActiveTab={setActiveTab} />
            </TabsContent>
            <TabsContent value="cash" className="mt-6 animate-slide-in-up">
              <CashTab />
            </TabsContent>
            <TabsContent value="bank" className="mt-6 animate-slide-in-up">
              <BankTab />
            </TabsContent>
            <TabsContent value="credit" className="mt-6 animate-slide-in-up">
              <CreditTab />
            </TabsContent>
            <TabsContent value="stock" className="mt-6 animate-slide-in-up">
              <StockTab />
            </TabsContent>
            <TabsContent value="settings" className="mt-6 animate-slide-in-up">
              <SettingsTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ShipShapeLedger />
  );
}
