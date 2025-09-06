
"use client"

import { useRef, useState, useMemo, ReactNode, useEffect, useCallback } from "react"
import { useAppContext } from "@/app/context/app-context"
import { useAppActions } from "@/app/context/app-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Eye, EyeOff, Users, Settings, Palette, FileCog, Recycle, Landmark, Activity, ArrowUpCircle, ArrowDownCircle, User, Contact, RefreshCw, Lock, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { RecycleBinTab } from "./recycle-bin-tab"
import { ExportImportTab } from "./export-import-tab"
import { ContactsTab } from "./contacts-tab"
import { ActivityLogTab } from "./activity-log-tab"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { cn } from "@/lib/utils"
import { UserManagementTab } from "./user-management-tab"
import { readData } from "@/lib/actions"
import type { Bank, Category } from "@/lib/types"

type SettingsPage = 'appearance' | 'general' | 'contacts' | 'users' | 'activity_log' | 'recycle_bin' | 'export_import';

function AppearanceSettings() {
  const {
    fontSize,
    currency,
  } = useAppContext();

  const {
    setFontSize,
    setCurrency,
  } = useAppActions();

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
      </CardContent>
    </Card>
  )
}

function GeneralSettings() {
  const { wastagePercentage, openInitialBalanceDialog } = useAppContext();
  const { addBank, addCategory, deleteCategory, setWastagePercentage } = useAppActions();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const newCategoryNameRef = useRef<HTMLInputElement>(null);
  const [newCategoryType, setNewCategoryType] = useState<'cash' | 'bank'>('cash');
  const [newCategoryDirection, setNewCategoryDirection] = useState<'credit' | 'debit' | undefined>();
  const wastageRef = useRef<HTMLInputElement>(null);
  const newBankNameRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [banksData, categoriesData] = await Promise.all([
            readData({ tableName: 'banks', select: '*' }),
            readData({ tableName: 'categories', select: '*' }),
        ]);
        setBanks((banksData as Bank[]) || []);
        setCategories((categoriesData as Category[]) || []);
    } catch (e: any) {
        toast.error("Failed to load general settings", { description: e.message });
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddBank = async () => {
    const name = newBankNameRef.current?.value.trim();
    if (name) {
      await addBank(name);
      if (newBankNameRef.current) newBankNameRef.current.value = "";
      toast.success("Bank Added");
      await fetchData(); // Refresh data
    }
  }

  const handleAddCategory = async () => {
    const name = newCategoryNameRef.current?.value.trim();
    if (!name) { toast.error('Category name required'); return; }
    if (!newCategoryDirection) { toast.error('Category direction required'); return; }
    
    await addCategory(newCategoryType, name, newCategoryDirection);
    if(newCategoryNameRef.current) newCategoryNameRef.current.value = "";
    setNewCategoryDirection(undefined);
    toast.success("Category Added");
    await fetchData(); // Refresh data
  }

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    toast.success("Category Deleted");
    fetchData(); // Refresh data
  }

  const handleWastageSave = () => {
    const percentage = parseFloat(wastageRef.current?.value || '0');
    if (percentage >= 0 && percentage <= 100) {
      setWastagePercentage(percentage);
      toast.success("Wastage Percentage Updated", { description: `Set to ${percentage}%.` });
    } else {
      toast.error("Invalid Percentage", { description: "Wastage must be between 0 and 100." });
    }
  }

  const { cashCategories, bankCategories } = useMemo(() => {
    return {
        cashCategories: categories.filter(c => c.type === 'cash'),
        bankCategories: categories.filter(c => c.type === 'bank')
    }
  }, [categories]);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
  }

  return (
     <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Initial Balances</CardTitle>
                <CardDescription>Set or reset the initial cash, bank, and stock balances for the application.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={openInitialBalanceDialog}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Set / Reset Initial Balances
                </Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Bank Accounts</CardTitle>
                        <CardDescription>Manage your bank accounts.</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button>
                </div>
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
                        <Button size="icon" onClick={handleAddBank}>
                        <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Category Management</CardTitle>
                    <CardDescription>Customize categories for your cash and bank transactions.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}><RefreshCw className="h-4 w-4" /></Button>
            </div>
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
                <Button size="sm" onClick={handleAddCategory}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Category
                </Button>
                </div>
            </div>
                <Separator />
            <div>
                <h3 className="font-semibold mb-2">Existing Categories</h3>
                <div className="space-y-4">
                    <div>
                    <h4 className="font-medium text-muted-foreground mb-2">Cash</h4>
                        <div className="flex flex-wrap gap-2">
                        {cashCategories.map(cat => (
                        <Badge key={cat.id} variant="secondary" className="flex items-center gap-2">
                            {!cat.is_deletable && <Lock className="h-3 w-3 text-muted-foreground" />}
                            {cat.name}
                            {cat.direction === 'credit' ? <ArrowUpCircle className="h-3 w-3 text-green-500"/> : <ArrowDownCircle className="h-3 w-3 text-red-500" />}
                            {cat.is_deletable && (
                                <button onClick={() => handleDeleteCategory(cat.id)} className="rounded-full hover:bg-muted-foreground/20">
                                <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </Badge>
                        ))}
                        {cashCategories.length === 0 && <p className="text-sm text-muted-foreground">No cash categories.</p>}
                    </div>
                    </div>
                    <div>
                    <h4 className="font-medium text-muted-foreground mb-2">Bank</h4>
                    <div className="flex flex-wrap gap-2">
                        {bankCategories.map(cat => (
                        <Badge key={cat.id} variant="secondary" className="flex items-center gap-2">
                            {!cat.is_deletable && <Lock className="h-3 w-3 text-muted-foreground" />}
                            {cat.name}
                            {cat.direction === 'credit' ? <ArrowUpCircle className="h-3 w-3 text-green-500"/> : <ArrowDownCircle className="h-3 w-3 text-red-500" />}
                            {cat.is_deletable && (
                                <button onClick={() => handleDeleteCategory(cat.id)} className="rounded-full hover:bg-muted-foreground/20">
                                <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </Badge>
                        ))}
                            {bankCategories.length === 0 && <p className="text-sm text-muted-foreground">No bank categories.</p>}
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
    { id: 'contacts', label: 'Contacts', icon: Contact, adminOnly: false, component: <ContactsTab /> },
    { id: 'users', label: 'Users', icon: Users, adminOnly: true, component: <UserManagementTab /> },
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
        <main key={activePage} className="md:col-span-3 animate-fade-in">
           {activeComponent}
        </main>
    </div>
  );
}
