
"use client";

import { useState } from 'react';
import { AppProvider, useAppContext } from './store';
import { cn } from '@/lib/utils';
import { Ship, Wallet, Landmark, Boxes, Settings, PlusCircle, Menu } from 'lucide-react';
import { DashboardTab } from '@/components/dashboard-tab';
import { CashTab } from '@/components/cash-tab';
import { BankTab } from '@/components/bank-tab';
import { StockTab } from '@/components/stock-tab';
import { SettingsTab } from '@/components/settings-tab';
import { InitialBalanceDialog } from '@/components/initial-balance-dialog';
import { UnifiedTransactionForm } from '@/components/unified-transaction-form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

const navItems = [
    { value: 'dashboard', label: 'Dashboard', icon: Wallet },
    { value: 'cash', label: 'Cash', icon: Wallet },
    { value: 'bank', label: 'Bank', icon: Landmark },
    { value: 'stock', label: 'Stock', icon: Boxes },
    { value: 'settings', label: 'Settings', icon: Settings },
]

function ShipShapeLedger() {
  const { fontSize } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if(isMobile) {
        setIsSheetOpen(false);
    }
  }

  return (
    <div className={cn('min-h-screen bg-background text-foreground', fontClasses[fontSize] || 'text-base')}>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 w-full">
            {isMobile && (
                 <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Ship className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-4">
                        <SheetHeader>
                           <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                           <SheetDescription className="sr-only">Select a tab to view your financial data.</SheetDescription>
                        </SheetHeader>
                         <div className="flex items-center gap-3 mb-6">
                            <Ship className="h-8 w-8 text-primary" />
                            <h1 className="text-xl font-bold text-primary font-headline">
                                ShipShape Ledger
                            </h1>
                        </div>
                        <nav className="flex flex-col gap-1">
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
                    </SheetContent>
                </Sheet>
            )}
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  {!isMobile && <Ship className="h-8 w-8 text-primary" />}
                  <h1 className="text-2xl sm:text-3xl font-bold text-primary font-headline">
                    ShipShape Ledger
                  </h1>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Your all-in-one ledger for cash, bank, and stock management.
                </p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto flex-shrink-0"><PlusCircle className="mr-2 h-4 w-4" /> Add Transaction</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <UnifiedTransactionForm setDialogOpen={setIsDialogOpen}/>
            </DialogContent>
          </Dialog>
        </header>
        <main>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
             {!isMobile && (
                <div className="overflow-x-auto pb-2">
                    <TabsList className="grid w-full grid-cols-5 min-w-[600px]">
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
            <TabsContent value="dashboard" className="mt-6">
              <DashboardTab setActiveTab={setActiveTab} />
            </TabsContent>
            <TabsContent value="cash" className="mt-6">
              <CashTab />
            </TabsContent>
            <TabsContent value="bank" className="mt-6">
              <BankTab />
            </TabsContent>
            <TabsContent value="stock" className="mt-6">
              <StockTab />
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
              <SettingsTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
      <InitialBalanceDialog />
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <ShipShapeLedger />
    </AppProvider>
  );
}
