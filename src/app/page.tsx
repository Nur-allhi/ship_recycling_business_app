"use client";

import { useState } from 'react';
import { AppProvider, useAppContext } from './store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Ship, Wallet, Landmark, Boxes, Settings } from 'lucide-react';
import { DashboardTab } from '@/components/dashboard-tab';
import { CashTab } from '@/components/cash-tab';
import { BankTab } from '@/components/bank-tab';
import { StockTab } from '@/components/stock-tab';
import { SettingsTab } from '@/components/settings-tab';
import { InitialBalanceDialog } from '@/components/initial-balance-dialog';

const fontClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

function ShipShapeLedger() {
  const { fontSize } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className={cn('min-h-screen bg-background text-foreground', fontClasses[fontSize] || 'text-base')}>
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Ship className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary font-headline">
              ShipShape Ledger
            </h1>
          </div>
          <p className="text-muted-foreground">
            Your all-in-one ledger for cash, bank, and stock management.
          </p>
        </header>
        <main>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
              <TabsTrigger value="dashboard"><Wallet className="mr-2 h-4 w-4" />Dashboard</TabsTrigger>
              <TabsTrigger value="cash"><Wallet className="mr-2 h-4 w-4" />Cash</TabsTrigger>
              <TabsTrigger value="bank"><Landmark className="mr-2 h-4 w-4" />Bank</TabsTrigger>
              <TabsTrigger value="stock"><Boxes className="mr-2 h-4 w-4" />Stock</TabsTrigger>
              <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Settings</TabsTrigger>
            </TabsList>
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
