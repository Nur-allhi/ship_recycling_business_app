
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
import { Plus, Trash2, Eye, EyeOff, Users, Settings, Palette, FileCog, Recycle, Landmark, Activity, ArrowUpCircle, ArrowDownCircle, User, Contact } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSelect } from "@/components/ui/responsive-select"
import { RecycleBinTab } from "./recycle-bin-tab"
import { ExportImportTab } from "./export-import-tab"
import { ContactsTab } from "./contacts-tab"
import { ActivityLogTab } from "./activity-log-tab"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { cn } from "@/lib/utils"
import { UserManagementTab } from "./user-management-tab"

type SettingsPage = 'appearance' | 'general' | 'contacts' | 'users' | 'activity_log' | 'recycle_bin' | 'export_import';

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
    cashCategories,
    bankCategories,
    addCategory,
    deleteCategory,
    wastagePercentage,
    setWastagePercentage,
  } = useAppContext();

  const newCategoryNameRef = useRef<HTMLInputElement>(null)
  const [newCategoryType, setNewCategoryType] = useState<'cash' | 'bank'>('cash');
  const [newCategoryDirection, setNewCategoryDirection] = useState<'credit' | 'debit' | undefined>();

  const wastageRef = useRef<HTMLInputElement>(null)

  const newBankNameRef = useRef<HTMLInputElement>(null)

  const handleAddBank = () => {
    const name = newBankNameRef.current?.value.trim();
    if (name) {
      addBank(name);
      if (newBankNameRef.current) newBankNameRef.current.value = "";
    }
  }

  const handleAddCategory = () => {
    const name = newCategoryNameRef.current?.value.trim();
    if (!name) {
        toast.error('Category name required');
        return;
    }
    if (!newCategoryDirection) {
        toast.error('Category direction required');
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
      toast.success("Wastage Percentage Updated", { description: `Set to ${percentage}%.` });
    } else {
      toast.error("Invalid Percentage", { description: "Wastage must be between 0 and 100." });
    }
  }

  const deletableCashCategories = useMemo(() => cashCategories.filter(c => c.is_deletable), [cashCategories]);
  const deletableBankCategories = useMemo(() => bankCategories.filter(c => c.is_deletable), [bankCategories]);

  return (
     <div className="space-y-6">
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

    
