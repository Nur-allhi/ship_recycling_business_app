
"use client"

import { useRef, useState, useMemo, ReactNode } from "react"
import { useAppContext } from "@/app/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Eye, EyeOff, Users, Settings, Palette, FileCog, Recycle, Landmark, Activity, ArrowUpCircle, ArrowDownCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { RecycleBinTab } from "./recycle-bin-tab"
import { ExportImportTab } from "./export-import-tab"
import { ContactsTab } from "./contacts-tab"
import { ActivityLogTab } from "./activity-log-tab"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { cn } from "@/lib/utils"

type SettingsPage = 'appearance' | 'general' | 'contacts' | 'activity_log' | 'recycle_bin' | 'export_import';

function AppearanceSettings() {
  const {
    fontSize,
    setFontSize,
    currency,
    setCurrency,
    showStockValue,
    setShowStockValue,
  } = useAppContext();

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
  }
  
  const currencyItems = useMemo(() => [
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'GBP', label: 'GBP (£)' },
    { value: 'JPY', label: 'JPY (¥)' },
    { value: 'INR', label: 'INR (₹)' },
    { value: 'BDT', label: 'BDT (৳)' },
  ], []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Adjust the look and feel of the app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Font Size</Label>
          <ToggleGroup type="single" value={fontSize} onValueChange={(value) => { if (value) setFontSize(value as any) }} className="mt-2">
            <ToggleGroupItem value="sm" aria-label="Small text">Small</ToggleGroupItem>
            <ToggleGroupItem value="base" aria-label="Normal text">Normal</ToggleGroupItem>
            <ToggleGroupItem value="lg" aria-label="Large text">Large</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div>
          <Label>Currency</Label>
          <ResponsiveSelect
              value={currency}
              onValueChange={handleCurrencyChange}
              title="Select currency"
              className="mt-2"
              items={currencyItems}
          />
        </div>
        <Separator />
        <div>
          <Label className="block mb-2">Data Visibility</Label>
            <Button variant="outline" size="sm" onClick={() => setShowStockValue(!showStockValue)}>
              {showStockValue ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showStockValue ? 'Hide' : 'Show'} Stock Total Value
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Toggle visibility for the 'Total Value' column in the stock transaction history.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function GeneralSettings() {
  const {
    banks,
    addBank,
    setInitialBalances,
    addInitialStockItem,
    cashCategories,
    bankCategories,
    addCategory,
    deleteCategory,
    wastagePercentage,
    setWastagePercentage,
  } = useAppContext();

  const { toast } = useToast()
  
  const cashBalanceRef = useRef<HTMLInputElement>(null)
  const bankRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const newCategoryNameRef = useRef<HTMLInputElement>(null)
  const [newCategoryType, setNewCategoryType] = useState<'cash' | 'bank'>('cash');
  const [newCategoryDirection, setNewCategoryDirection] = useState<'credit' | 'debit' | undefined>();

  const wastageRef = useRef<HTMLInputElement>(null)
  
  const stockItemNameRef = useRef<HTMLInputElement>(null)
  const stockWeightRef = useRef<HTMLInputElement>(null)
  const stockPriceRef = useRef<HTMLInputElement>(null)

  const newBankNameRef = useRef<HTMLInputElement>(null)

  const handleAddBank = () => {
    const name = newBankNameRef.current?.value.trim();
    if (name) {
      addBank(name);
      if (newBankNameRef.current) newBankNameRef.current.value = "";
    }
  }

  const handleBalanceSave = () => {
    const cash = parseFloat(cashBalanceRef.current?.value || '0');
    const bankTotals: Record<string, number> = {};

    for(const bank of banks) {
        const bankVal = parseFloat(bankRefs.current[bank.id]?.value || '0');
        if (isNaN(bankVal) || bankVal < 0) {
            toast({
                variant: "destructive",
                title: "Invalid Input",
                description: `Please enter a valid, non-negative number for ${bank.name}.`,
            });
            return;
        }
        bankTotals[bank.id] = bankVal;
    }

    if (isNaN(cash) || cash < 0) {
        toast({
            variant: "destructive",
            title: "Invalid Input",
            description: "Please enter a valid, non-negative number for cash balance.",
        });
        return;
    }

    setInitialBalances(cash, bankTotals);
    toast({ title: "Balances Updated", description: "Initial cash and bank balances have been set." });
  }

  const handleInitialStockSave = () => {
    const name = stockItemNameRef.current?.value.trim();
    const weight = parseFloat(stockWeightRef.current?.value || '');
    const price = parseFloat(stockPriceRef.current?.value || '');

    if (!name || isNaN(weight) || isNaN(price) || weight <= 0 || price < 0) {
        toast({
            variant: "destructive",
            title: "Invalid Stock Input",
            description: "Please fill all stock fields with valid values.",
        });
        return;
    }

    addInitialStockItem({ name, weight, pricePerKg: price });
    toast({ title: "Initial Stock Added", description: `${name} has been added to your inventory.` });

    if(stockItemNameRef.current) stockItemNameRef.current.value = "";
    if(stockWeightRef.current) stockWeightRef.current.value = "";
    if(stockPriceRef.current) stockPriceRef.current.value = "";
  }


  const handleAddCategory = () => {
    const name = newCategoryNameRef.current?.value.trim();
    if (!name) {
        toast({variant: 'destructive', title: 'Category name required'});
        return;
    }
    if (!newCategoryDirection) {
        toast({variant: 'destructive', title: 'Category direction required'});
        return;
    }
    addCategory(newCategoryType, name, newCategoryDirection);
    if(newCategoryNameRef.current) newCategoryNameRef.current.value = "";
    setNewCategoryDirection(undefined);
  }

  const handleWastageSave = () => {
    const percentage = parseFloat(wastageRef.current?.value || '0');
    if (percentage >= 0 && percentage <= 100) {
      setWastagePercentage(percentage);
      toast({ title: "Wastage Percentage Updated", description: `Set to ${percentage}%.` });
    } else {
      toast({ variant: "destructive", title: "Invalid Percentage", description: "Wastage must be between 0 and 100." });
    }
  }

  const deletableCashCategories = useMemo(() => cashCategories.filter(c => c.is_deletable), [cashCategories]);
  const deletableBankCategories = useMemo(() => bankCategories.filter(c => c.is_deletable), [bankCategories]);

  return (
     <div className="space-y-6">
        <Card>
            <CardHeader>
            <CardTitle>Initial Balances</CardTitle>
            <CardDescription>Set your starting cash, bank, and stock balances. This should be done once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                <h3 className="font-semibold mb-2">Financial Balances</h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cash-balance">Initial Cash Balance</Label>
                        <Input id="cash-balance" type="number" ref={cashBalanceRef} placeholder="0.00" />
                    </div>
                    {banks.map(bank => (
                        <div key={bank.id} className="space-y-2">
                            <Label htmlFor={`bank-balance-${bank.id}`}>Initial Balance for {bank.name}</Label>
                            <Input 
                                id={`bank-balance-${bank.id}`} 
                                type="number" 
                                ref={el => bankRefs.current[bank.id] = el} 
                                placeholder="0.00"
                            />
                        </div>
                    ))}
                    <Button onClick={handleBalanceSave}>Save Financial Balances</Button>
                </div>
                </div>
                <Separator />
                <div>
                <h3 className="font-semibold mb-2">Initial Stock Inventory</h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="stock-item-name">Item Name</Label>
                        <Input id="stock-item-name" type="text" ref={stockItemNameRef} placeholder="e.g. Rice"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="stock-weight">Total Stock Weight (kg)</Label>
                            <Input id="stock-weight" type="number" ref={stockWeightRef} placeholder="e.g. 1000"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stock-price">Average Purchase Price/kg</Label>
                            <Input id="stock-price" type="number" ref={stockPriceRef} placeholder="e.g. 50.00"/>
                        </div>
                    </div>
                    <Button onClick={handleInitialStockSave}>Add Initial Stock Item</Button>
                </div>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Bank Accounts</CardTitle>
                <CardDescription>Manage your bank accounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                    <div>
                    <h3 className="font-semibold mb-2">Existing Bank Accounts</h3>
                    {banks.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            {banks.map(bank => <li key={bank.id}>{bank.name}</li>)}
                        </ul>
                    ) : <p className="text-sm text-muted-foreground">No bank accounts created yet.</p>}
                    </div>
                    <Separator/>
                    <div>
                    <h3 className="font-semibold mb-2">Add New Bank Account</h3>
                    <div className="flex gap-2">
                        <Input placeholder="New bank account name" ref={newBankNameRef} />
                        <Button size="icon" onClick={handleAddBank}><Plus className="h-4 w-4" /></Button>
                    </div>
                    </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle>Category Management</CardTitle>
            <CardDescription>Customize categories for your cash and bank transactions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            <div>
                <h3 className="font-semibold mb-2">Add New Category</h3>
                <div className="p-4 border rounded-lg space-y-4">
                <div className="space-y-2">
                    <Label>Type</Label>
                    <RadioGroup onValueChange={(v) => setNewCategoryType(v as any)} value={newCategoryType} className="flex pt-2 gap-4">
                        <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" /> Cash</Label>
                        <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" /> Bank</Label>
                    </RadioGroup>
                </div>
                    <div className="space-y-2">
                    <Label htmlFor="new-cat-name">Category Name</Label>
                    <Input id="new-cat-name" placeholder="e.g. Office Supplies" ref={newCategoryNameRef} />
                </div>
                    <div className="space-y-2">
                    <Label>Direction</Label>
                    <RadioGroup onValueChange={(v) => setNewCategoryDirection(v as any)} value={newCategoryDirection} className="flex pt-2 gap-4">
                        <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="credit" /> Credit (Money In)</Label>
                        <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="debit" /> Debit (Money Out)</Label>
                    </RadioGroup>
                </div>
                <Button size="sm" onClick={handleAddCategory}><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
                </div>
            </div>
                <Separator />
            <div>
                <h3 className="font-semibold mb-2">Custom Categories</h3>
                <div className="space-y-4">
                    <div>
                    <h4 className="font-medium text-muted-foreground mb-2">Cash</h4>
                        <div className="flex flex-wrap gap-2">
                        {deletableCashCategories.map(cat => (
                        <Badge key={cat.id} variant="secondary" className="flex items-center gap-2">
                            {cat.name}
                            {cat.direction === 'credit' ? <ArrowUpCircle className="h-3 w-3 text-green-500"/> : <ArrowDownCircle className="h-3 w-3 text-red-500" />}
                            <button onClick={() => deleteCategory(cat.id)} className="rounded-full hover:bg-muted-foreground/20">
                            <Trash2 className="h-3 w-3" />
                            </button>
                        </Badge>
                        ))}
                        {deletableCashCategories.length === 0 && <p className="text-sm text-muted-foreground">No custom cash categories.</p>}
                    </div>
                    </div>
                    <div>
                    <h4 className="font-medium text-muted-foreground mb-2">Bank</h4>
                    <div className="flex flex-wrap gap-2">
                        {deletableBankCategories.map(cat => (
                        <Badge key={cat.id} variant="secondary" className="flex items-center gap-2">
                            {cat.name}
                            {cat.direction === 'credit' ? <ArrowUpCircle className="h-3 w-3 text-green-500"/> : <ArrowDownCircle className="h-3 w-3 text-red-500" />}
                            <button onClick={() => deleteCategory(cat.id)} className="rounded-full hover:bg-muted-foreground/20">
                            <Trash2 className="h-3 w-3" />
                            </button>
                        </Badge>
                        ))}
                            {deletableBankCategories.length === 0 && <p className="text-sm text-muted-foreground">No custom bank categories.</p>}
                    </div>
                    </div>
                </div>
            </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle>Wastage Settings</CardTitle>
            <CardDescription>Set a default wastage percentage for stock sales. This is applied to the weight of the sold item.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="wastage-percentage">Wastage Percentage (%)</Label>
                <Input id="wastage-percentage" type="number" step="0.01" defaultValue={wastagePercentage} ref={wastageRef} />
            </div>
            <Button onClick={handleWastageSave}>Save Wastage Setting</Button>
            </CardContent>
        </Card>
     </div>
  )
}

export function SettingsTab() {
  const { user } = useAppContext();
  const isAdmin = user?.role === 'admin';
  const [activePage, setActivePage] = useState<SettingsPage>('appearance');

  const navItems: {id: SettingsPage, label: string, icon: React.ElementType, adminOnly: boolean, component: ReactNode}[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette, adminOnly: false, component: <AppearanceSettings /> },
    { id: 'general', label: 'General', icon: Settings, adminOnly: true, component: <GeneralSettings /> },
    { id: 'contacts', label: 'Contacts & Users', icon: Users, adminOnly: true, component: <ContactsTab /> },
    { id: 'activity_log', label: 'Activity Log', icon: Activity, adminOnly: true, component: <ActivityLogTab /> },
    { id: 'recycle_bin', label: 'Recycle Bin', icon: Recycle, adminOnly: true, component: <RecycleBinTab /> },
    { id: 'export_import', label: 'Export/Import', icon: FileCog, adminOnly: false, component: <ExportImportTab /> },
  ]
  
  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const activeComponent = useMemo(() => {
    return navItems.find(item => item.id === activePage)?.component;
  }, [activePage, navItems]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
            <nav className="flex flex-col space-y-1">
                {filteredNavItems.map(item => (
                    <Button 
                        key={item.id} 
                        variant={activePage === item.id ? 'secondary' : 'ghost'}
                        onClick={() => setActivePage(item.id)}
                        className="justify-start"
                    >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                    </Button>
                ))}
            </nav>
        </aside>
        <main className="md:col-span-3">
           {activeComponent}
        </main>
    </div>
  );
}

    