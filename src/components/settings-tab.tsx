
"use client"

import { useRef, useState, useMemo, ReactNode, useCallback } from "react"
import { useAppContext } from "@/app/context/app-context"
import { useAppActions } from "@/app/context/app-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Users, Settings, Palette, FileCog, Recycle, Loader2, ArrowUpCircle, ArrowDownCircle, Lock, Contact2, History } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { RecycleBinTab } from "./recycle-bin-tab"
import { ExportImportTab } from "./export-import-tab"
import { ContactsTab } from "./contacts-tab"
import { ActivityLogTab } from "./activity-log-tab"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { UserManagementTab } from "./user-management-tab"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"

type SettingsPage = 'appearance' | 'general' | 'contacts' | 'users' | 'activity_log' | 'recycle_bin' | 'export_import';

function AppearanceSettings() {
  const {
    fontSize,
    currency,
    showStockValue,
  } = useAppContext();

  const {
    setFontSize,
    setCurrency,
    setShowStockValue
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
         <div>
          <Label>Stock Value Visibility</Label>
          <RadioGroup onValueChange={(v) => setShowStockValue(v === 'true')} value={String(showStockValue)} className="flex pt-2 gap-4">
              <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="true" /> Show</Label>
              <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="false" /> Hide</Label>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  )
}

function GeneralSettings() {
  const { openInitialBalanceDialog } = useAppContext();
  const { addBank, addCategory, deleteCategory: deleteCategoryAction } = useAppActions();
  
  const banks = useLiveQuery(() => db.banks.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const [isAddingBank, setIsAddingBank] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const newCategoryNameRef = useRef<HTMLInputElement>(null);
  const [newCategoryType, setNewCategoryType] = useState<'cash' | 'bank'>('cash');
  const [newCategoryDirection, setNewCategoryDirection] = useState<'credit' | 'debit' | undefined>();
  const newBankNameRef = useRef<HTMLInputElement>(null);

  const handleAddBank = useCallback(async () => {
    const name = newBankNameRef.current?.value.trim();
    if (!name) return;
    
    setIsAddingBank(true);
    try {
      await addBank(name);
      if (newBankNameRef.current) newBankNameRef.current.value = "";
      toast.success("Bank Added Successfully");
    } catch (e: any) {
      toast.error("Failed to add bank", { description: e.message });
    } finally {
      setIsAddingBank(false);
    }
  }, [addBank]);

  const handleAddCategory = useCallback(async () => {
    const name = newCategoryNameRef.current?.value.trim();
    if (!name) { toast.error('Category name required'); return; }
    if (!newCategoryDirection) { toast.error('Category direction required'); return; }
    
    setIsAddingCategory(true);
    try {
        await addCategory(newCategoryType, name, newCategoryDirection);
        if(newCategoryNameRef.current) newCategoryNameRef.current.value = "";
        setNewCategoryDirection(undefined);
        toast.success("Category Added Successfully");
    } catch(e: any) {
        toast.error("Failed to add category", { description: e.message });
    } finally {
        setIsAddingCategory(false);
    }
  }, [addCategory, newCategoryDirection, newCategoryType]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    try {
        await deleteCategoryAction(id);
        toast.success("Category Deleted");
    } catch (e:any) {
        toast.error("Failed to delete category", { description: e.message });
    }
  }, [deleteCategoryAction]);

  const { cashCategories, bankCategories } = useMemo(() => {
    const allCategories = categories || [];
    return {
        cashCategories: allCategories.filter(c => c.type === 'cash'),
        bankCategories: allCategories.filter(c => c.type === 'bank')
    }
  }, [categories]);

  if (!banks || !categories) {
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
                    Set / Reset Initial Balances
                </Button>
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
                        <Button size="icon" onClick={handleAddBank} disabled={isAddingBank}>
                            {isAddingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
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
                <Button size="sm" onClick={handleAddCategory} disabled={isAddingCategory}>
                   {isAddingCategory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
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
     </div>
  )
}

export function SettingsTab() {
  const { user } = useAppContext();
  const isAdmin = user?.role === 'admin';
  const [activePage, setActivePage] = useState<SettingsPage>('appearance');

  const navItems: {id: SettingsPage, label: string, icon: React.ElementType, adminOnly: boolean}[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette, adminOnly: false },
    { id: 'general', label: 'General', icon: Settings, adminOnly: true },
    { id: 'contacts', label: 'Contacts', icon: Contact2, adminOnly: false },
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'activity_log', label: 'Activity Log', icon: History, adminOnly: true },
    { id: 'recycle_bin', label: 'Recycle Bin', icon: Recycle, adminOnly: true },
    { id: 'export_import', label: 'Export/Import', icon: FileCog, adminOnly: false },
  ]
  
  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const renderActivePage = () => {
    switch (activePage) {
        case 'appearance': return <AppearanceSettings />;
        case 'general': return <GeneralSettings />;
        case 'contacts': return <ContactsTab />;
        case 'users': return <UserManagementTab />;
        case 'activity_log': return <ActivityLogTab />;
        case 'recycle_bin': return <RecycleBinTab />;
        case 'export_import': return <ExportImportTab />;
        default: return <AppearanceSettings />;
    }
  };

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
           <div key={activePage} className="animate-fade-in">
             {renderActivePage()}
           </div>
        </main>
    </div>
  );
}
