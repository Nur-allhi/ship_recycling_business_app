
"use client";

import { useState } from 'react';
import { AppProvider, useAppContext } from './store';
import { cn } from '@/lib/utils';
import { Ship, Wallet, Landmark, Boxes, Settings, PlusCircle } from 'lucide-react';
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

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

function ShipShapeLedger() {
  const { fontSize } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className={cn('min-h-screen bg-background text-foreground', fontClasses[fontSize] || 'text-base')}>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Ship className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-primary font-headline">
                ShipShape Ledger
              </h1>
            </div>
            <p className="text-muted-foreground">
              Your all-in-one ledger for cash, bank, and stock management.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Add Transaction</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <UnifiedTransactionForm setDialogOpen={setIsDialogOpen}/>
            </DialogContent>
          </Dialog>
        </header>
        <main>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
             <div className="overflow-x-auto pb-2">
                <TabsList className="grid w-full grid-cols-5 min-w-[500px]">
                    <TabsTrigger value="dashboard"><Wallet className="mr-2 h-4 w-4" />Dashboard</TabsTrigger>
                    <TabsTrigger value="cash"><Wallet className="mr-2 h-4 w-4" />Cash</TabsTrigger>
                    <TabsTrigger value="bank"><Landmark className="mr-2 h-4 w-4" />Bank</TabsTrigger>
                    <TabsTrigger value="stock"><Boxes className="mr-2 h-4 w-4" />Stock</TabsTrigger>
                    <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Settings</TabsTrigger>
                </TabsList>
            </div>
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
