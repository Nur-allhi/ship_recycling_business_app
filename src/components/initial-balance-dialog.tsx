
"use client";

import { useRef, useState }from 'react';
import { useAppContext } from '@/app/context/app-context';
import { useAppActions } from '@/app/context/app-actions';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Landmark, Wallet, Boxes, PlusCircle, Trash2, CalendarIcon, Loader2 } from 'lucide-react';
import { Separator } from './ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface InitialBalanceDialogProps {
  isOpen: boolean;
}

interface StockItemEntry {
    id: number;
    name: string;
    weight: number | '';
    pricePerKg: number | '';
}

export function InitialBalanceDialog({ isOpen }: InitialBalanceDialogProps) {
  const { banks, closeInitialBalanceDialog } = useAppContext();
  const { setInitialBalances, addInitialStockItem } = useAppActions();
  const cashRef = useRef<HTMLInputElement>(null);
  const bankRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [stockItems, setStockItems] = useState<StockItemEntry[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  const handleAddStockItem = () => {
      setStockItems([...stockItems, { id: Date.now(), name: '', weight: '', pricePerKg: '' }]);
  }
  
  const handleRemoveStockItem = (id: number) => {
      setStockItems(stockItems.filter(item => item.id !== id));
  }
  
  const handleStockItemChange = (id: number, field: keyof Omit<StockItemEntry, 'id'>, value: string) => {
    let finalValue: string | number = value;
    if (field === 'weight' || field === 'pricePerKg') {
      // Allow empty string for user input, otherwise parse to float.
      finalValue = value === '' ? '' : parseFloat(value);
      // If parsing results in NaN (e.g., from invalid characters), default to empty string.
      if (isNaN(finalValue as number)) {
        finalValue = '';
      }
    }
    setStockItems(stockItems.map(item => item.id === id ? { ...item, [field]: finalValue } : item));
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const cash = parseFloat(cashRef.current?.value || '0');
        if (isNaN(cash) || cash < 0) {
          toast.error(
            'Invalid Input',
            {description: 'Please enter a valid, non-negative number for the cash balance.',}
          );
          setIsSaving(false);
          return;
        }
        
        const bankTotals: Record<string, number> = {};
        for (const bank of banks) {
          const value = parseFloat(bankRefs.current[bank.id]?.value || '0');
          if (isNaN(value) || value < 0) {
            toast.error(
                'Invalid Input',
                {description: `Please enter a valid, non-negative number for ${bank.name}.`,}
            );
            setIsSaving(false);
            return;
          }
          bankTotals[bank.id] = value;
        }

        for (const item of stockItems) {
            // Treat empty string as 0 for validation and saving.
            const weight = item.weight === '' ? 0 : Number(item.weight);
            const pricePerKg = item.pricePerKg === '' ? 0 : Number(item.pricePerKg);

            if (!item.name || isNaN(weight) || weight <= 0 || isNaN(pricePerKg) || pricePerKg < 0) {
                toast.error('Invalid Stock Item', {
                    description: `Please ensure all fields for "${item.name || 'new item'}" are filled correctly.`
                });
                setIsSaving(false);
                return;
            }
        }
        
        // Pass the selected date to the context function
        await setInitialBalances(cash, bankTotals, date);

        // Now, add the stock items one by one.
        for (const item of stockItems) {
            await addInitialStockItem({ 
                name: item.name, 
                weight: Number(item.weight), 
                pricePerKg: Number(item.pricePerKg) 
            });
        }

        toast.success("Initial Balances Set", { description: "Your initial financial and stock balances have been saved." });
        closeInitialBalanceDialog();
        
    } catch(e: any) {
        toast.error("Failed to Save", { description: e.message || "An unknown error occurred." });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Also reset local state when closing dialog without saving
    setStockItems([]);
    if(cashRef.current) cashRef.current.value = "0";
    Object.values(bankRefs.current).forEach(ref => {
      if (ref) ref.value = "0";
    });
    closeInitialBalanceDialog();
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Initial Balances</DialogTitle>
          <DialogDescription>
            To get started, please set your initial financial and stock balances for a specific date. You can change this later from Settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
                <Label htmlFor="start-date">Balance Start Date</Label>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => {
                                if(d) setDate(d);
                                setIsDatePickerOpen(false);
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center"><Wallet className="mr-2 h-5 w-5" />Financial Balances</h3>
                 <div className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cash-balance" className="text-right">
                        Cash
                        </Label>
                        <Input
                        id="cash-balance"
                        ref={cashRef}
                        type="number"
                        placeholder="Initial Cash"
                        className="col-span-3"
                        defaultValue="0"
                        />
                    </div>
                    {banks.map(bank => (
                        <div key={bank.id} className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor={`bank-balance-${bank.id}`} className="text-right text-sm">
                            {bank.name}
                        </Label>
                        <Input
                            id={`bank-balance-${bank.id}`}
                            ref={el => { bankRefs.current[bank.id] = el; }}
                            type="number"
                            placeholder="Initial Bank Balance"
                            className="col-span-3"
                            defaultValue="0"
                        />
                        </div>
                    ))}
                    {banks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center col-span-4">
                        No bank accounts found. You can add them in Settings {'>'} General.
                        </p>
                    )}
                 </div>
            </div>

            <Separator />

            <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center"><Boxes className="mr-2 h-5 w-5"/>Stock Balances</h3>
                 <div className="space-y-4">
                    {stockItems.map((item, index) => (
                        <div key={item.id} className="p-4 border rounded-lg space-y-3 relative">
                            <Label className="font-medium">Stock Item #{index + 1}</Label>
                             <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleRemoveStockItem(item.id)}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor={`item-name-${item.id}`} className="text-xs">Item Name</Label>
                                    <Input id={`item-name-${item.id}`} value={item.name} onChange={e => handleStockItemChange(item.id, 'name', e.target.value)} placeholder="e.g. Iron Rod" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`item-weight-${item.id}`} className="text-xs">Weight (kg)</Label>
                                    <Input id={`item-weight-${item.id}`} type="number" value={item.weight} onChange={e => handleStockItemChange(item.id, 'weight', e.target.value)} placeholder="0.00" />
                                </div>
                                 <div className="space-y-1">
                                    <Label htmlFor={`item-price-${item.id}`} className="text-xs">Price/kg</Label>
                                    <Input id={`item-price-${item.id}`} type="number" value={item.pricePerKg} onChange={e => handleStockItemChange(item.id, 'pricePerKg', e.target.value)} placeholder="0.00" />
                                </div>
                            </div>
                        </div>
                    ))}
                    <Button variant="outline" onClick={handleAddStockItem} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Stock Item
                    </Button>
                 </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Set Balances Later</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save and Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
