
"use client"

import { useRef } from "react"
import { useAppContext } from "@/app/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function SettingsTab() {
  const {
    cashBalance,
    bankBalance,
    setInitialBalances,
    fontSize,
    setFontSize,
    cashCategories,
    bankCategories,
    addCategory,
    deleteCategory,
    wastagePercentage,
    setWastagePercentage,
    currency,
    setCurrency
  } = useAppContext()
  const { toast } = useToast()

  const cashBalanceRef = useRef<HTMLInputElement>(null)
  const bankBalanceRef = useRef<HTMLInputElement>(null)
  const cashCategoryRef = useRef<HTMLInputElement>(null)
  const bankCategoryRef = useRef<HTMLInputElement>(null)
  const wastageRef = useRef<HTMLInputElement>(null)


  const handleBalanceSave = () => {
    const cash = parseFloat(cashBalanceRef.current?.value || '0')
    const bank = parseFloat(bankBalanceRef.current?.value || '0')
    setInitialBalances(cash, bank)
    toast({ title: "Balances Updated", description: "Initial balances have been set." })
  }

  const handleAddCategory = (type: 'cash' | 'bank') => {
    const ref = type === 'cash' ? cashCategoryRef : bankCategoryRef
    const category = ref.current?.value.trim()
    if (category) {
      addCategory(type, category)
      ref.current.value = ""
    }
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

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    toast({ title: "Currency Updated", description: `Set to ${value}.` });
  }


  return (
    <div className="max-w-2xl mx-auto">
      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="wastage">Wastage</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Initial Balances</CardTitle>
              <CardDescription>Set your starting cash and bank balances. This should be done once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cash-balance">Initial Cash Balance</Label>
                <Input id="cash-balance" type="number" defaultValue={cashBalance} ref={cashBalanceRef} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-balance">Initial Bank Balance</Label>
                <Input id="bank-balance" type="number" defaultValue={bankBalance} ref={bankBalanceRef} />
              </div>
              <Button onClick={handleBalanceSave}>Save Balances</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="wastage">
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
        </TabsContent>
        <TabsContent value="categories">
           <Card>
            <CardHeader>
              <CardTitle>Category Management</CardTitle>
              <CardDescription>Customize categories for your transactions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Cash Categories</h3>
                <div className="flex gap-2 mb-3">
                  <Input placeholder="New cash category" ref={cashCategoryRef} />
                  <Button size="icon" onClick={() => handleAddCategory('cash')}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cashCategories.map(cat => (
                    <Badge key={cat} variant="secondary" className="flex items-center gap-2">
                      {cat}
                      <button onClick={() => deleteCategory('cash', cat)} className="rounded-full hover:bg-muted-foreground/20">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Bank Categories</h3>
                <div className="flex gap-2 mb-3">
                  <Input placeholder="New bank category" ref={bankCategoryRef} />
                  <Button size="icon" onClick={() => handleAddCategory('bank')}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bankCategories.map(cat => (
                    <Badge key={cat} variant="secondary" className="flex items-center gap-2">
                      {cat}
                      <button onClick={() => deleteCategory('bank', cat)} className="rounded-full hover:bg-muted-foreground/20">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Adjust the look and feel of the app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Select value={currency} onValueChange={handleCurrencyChange}>
                    <SelectTrigger className="w-[180px] mt-2">
                        <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="BDT">BDT (৳)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
