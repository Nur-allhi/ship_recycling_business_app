
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppContext } from '@/app/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, PlusCircle, Wallet, Landmark, Boxes, ArrowRightLeft } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const formSchema = z.object({
  transactionType: z.enum(['cash', 'bank', 'stock', 'transfer']),
  amount: z.coerce.number().optional(), // Optional now, required conditionally
  description: z.string().optional(),
  category: z.string().optional(),
  date: z.date(),
  
  // stock specific
  stockType: z.enum(['purchase', 'sale']).optional(),
  stockItemName: z.string().optional(),
  weight: z.coerce.number().optional(),
  pricePerKg: z.coerce.number().optional(),
  paymentMethod: z.enum(['cash', 'bank']).optional(),

  // cash/bank specific
  inOutType: z.enum(['in', 'out']).optional(),

  // transfer specific
  transferFrom: z.enum(['cash', 'bank']).optional(),

}).superRefine((data, ctx) => {
    if (data.transactionType === 'stock') {
        if (!data.stockType) {
            ctx.addIssue({ code: 'custom', message: 'Please select purchase or sale.', path: ['stockType'] });
        }
        if (!data.stockItemName) {
            ctx.addIssue({ code: 'custom', message: 'Stock item name is required.', path: ['stockItemName'] });
        }
        if (!data.weight || data.weight <= 0) {
            ctx.addIssue({ code: 'custom', message: 'Weight must be positive.', path: ['weight'] });
        }
        if (data.pricePerKg === undefined || data.pricePerKg < 0) { // Price can be 0
            ctx.addIssue({ code: 'custom', message: 'Price must be non-negative.', path: ['pricePerKg'] });
        }
        if (!data.paymentMethod) {
            ctx.addIssue({ code: 'custom', message: 'Payment method is required.', path: ['paymentMethod'] });
        }
    }
    if(data.transactionType === 'cash' || data.transactionType === 'bank' || data.transactionType === 'transfer') {
        if(!data.amount || data.amount <=0){
             ctx.addIssue({ code: 'custom', message: 'Amount must be positive.', path: ['amount'] });
        }
    }
    if(data.transactionType === 'cash' || data.transactionType === 'bank') {
        if (!data.inOutType) {
            ctx.addIssue({ code: 'custom', message: 'Transaction direction is required.', path: ['inOutType'] });
        }
        if (!data.category) {
            ctx.addIssue({ code: 'custom', message: 'Category is required.', path: ['category'] });
        }
         if (!data.description) {
            ctx.addIssue({ code: 'custom', message: 'Description is required.', path: ['description'] });
        }
    }
    if(data.transactionType === 'transfer') {
        if (!data.transferFrom) {
            ctx.addIssue({ code: 'custom', message: 'Transfer source is required.', path: ['transferFrom'] });
        }
    }
});


type FormData = z.infer<typeof formSchema>;

interface UnifiedTransactionFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function UnifiedTransactionForm({ setDialogOpen }: UnifiedTransactionFormProps) {
  const { 
    addCashTransaction, 
    addBankTransaction, 
    addStockTransaction, 
    transferFunds,
    cashCategories,
    bankCategories,
    stockItems
  } = useAppContext();
  
  const { toast } = useToast();
  
  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        transactionType: 'cash',
        amount: undefined,
        description: "",
        date: new Date(),
    }
  });

  const transactionType = watch('transactionType');
  const stockType = watch('stockType');
  const [isNewStockItem, setIsNewStockItem] = useState(false);

  useEffect(() => {
    // Reset fields when tab changes
    reset({
        date: new Date(),
        amount: undefined,
        description: "",
        transactionType: transactionType as any
    });
    setIsNewStockItem(false);
  }, [transactionType, reset]);


  const onSubmit = (data: FormData) => {
    const transactionDate = data.date.toISOString();
    switch(data.transactionType) {
        case 'cash':
            addCashTransaction({
                type: data.inOutType === 'in' ? 'income' : 'expense',
                amount: data.amount!,
                description: data.description!,
                category: data.category!,
                date: transactionDate,
            });
            break;
        case 'bank':
             addBankTransaction({
                type: data.inOutType === 'in' ? 'deposit' : 'withdrawal',
                amount: data.amount!,
                description: data.description!,
                category: data.category!,
                date: transactionDate,
            });
            break;
        case 'stock':
            addStockTransaction({
                type: data.stockType!,
                stockItemName: data.stockItemName!,
                weight: data.weight!,
                pricePerKg: data.pricePerKg!,
                paymentMethod: data.paymentMethod!,
                description: data.description,
                date: transactionDate,
            });
            break;
        case 'transfer':
            transferFunds(data.transferFrom!, data.amount!, transactionDate);
            break;
    }
    toast({ title: "Transaction Added", description: "Your transaction has been successfully recorded." });
    reset();
    setDialogOpen(false);
  };

  const currentCategories = transactionType === 'cash' ? cashCategories : bankCategories;
  
  const dateField = (
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Controller
            control={control}
            name="date"
            render={({ field }) => (
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "dd-MM-yyyy") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            )}
        />
        {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
    </div>
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center"><PlusCircle className="mr-2 h-6 w-6" /> Add a New Transaction</DialogTitle>
        <DialogDescription>Select a transaction type and fill in the details below.</DialogDescription>
      </DialogHeader>
        <Controller
            control={control}
            name="transactionType"
            rules={{ required: true }}
            render={({ field }) => (
                <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="cash"><Wallet className="mr-2 h-4 w-4" />Cash</TabsTrigger>
                        <TabsTrigger value="bank"><Landmark className="mr-2 h-4 w-4" />Bank</TabsTrigger>
                        <TabsTrigger value="stock"><Boxes className="mr-2 h-4 w-4" />Stock</TabsTrigger>
                        <TabsTrigger value="transfer"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</TabsTrigger>
                    </TabsList>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="space-y-4 pt-6">
                            <TabsContent value="cash" className="m-0 space-y-4 animate-fade-in">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    {dateField}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount</Label>
                                    <Input id="amount" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                                    {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Direction</Label>
                                    <Controller 
                                        control={control}
                                        name="inOutType"
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                                                <Label htmlFor="in" className="flex items-center gap-2 cursor-pointer">
                                                    <RadioGroupItem value="in" id="in" />Income
                                                </Label>
                                                <Label htmlFor="out" className="flex items-center gap-2 cursor-pointer">
                                                    <RadioGroupItem value="out" id="out" />Expense
                                                </Label>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.inOutType && <p className="text-sm text-destructive">{errors.inOutType.message}</p>}
                                </div>
                              </div>
                               <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Controller
                                        control={control}
                                        name="category"
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                                <SelectContent>
                                                    {currentCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                                </div>
                            </TabsContent>

                            <TabsContent value="bank" className="m-0 space-y-4 animate-fade-in">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                    {dateField}
                                 </div>
                                <div className="space-y-2">
                                    <Label htmlFor="amount-bank">Amount</Label>
                                    <Input id="amount-bank" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                                    {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Direction</Label>
                                    <Controller 
                                        control={control}
                                        name="inOutType"
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                                                <Label htmlFor="in-bank" className="flex items-center gap-2 cursor-pointer">
                                                    <RadioGroupItem value="in" id="in-bank" />Deposit
                                                </Label>
                                                <Label htmlFor="out-bank" className="flex items-center gap-2 cursor-pointer">
                                                    <RadioGroupItem value="out" id="out-bank" />Withdrawal
                                                </Label>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.inOutType && <p className="text-sm text-destructive">{errors.inOutType.message}</p>}
                                </div>
                              </div>
                               <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Controller
                                        control={control}
                                        name="category"
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                                <SelectContent>
                                                    {currentCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="stock" className="m-0 space-y-4 animate-fade-in">
                                {dateField}
                                <div className="space-y-2">
                                    <Label>Transaction Type</Label>
                                     <Controller 
                                        control={control}
                                        name="stockType"
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                                                <Label htmlFor="purchase" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="purchase" id="purchase" />Purchase</Label>
                                                <Label htmlFor="sale" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="sale" id="sale" />Sale</Label>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.stockType && <p className="text-sm text-destructive">{errors.stockType.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Item Name</Label>
                                    {stockType === 'purchase' ? (
                                        <div className="flex items-center gap-2">
                                            {isNewStockItem ? (
                                                <Input {...register('stockItemName')} placeholder="e.g. Iron Rod"/>
                                            ) : (
                                                <Controller
                                                    control={control}
                                                    name="stockItemName"
                                                    render={({ field }) => (
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <SelectTrigger><SelectValue placeholder="Select existing item" /></SelectTrigger>
                                                            <SelectContent>
                                                                {stockItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            )}
                                            <Button type="button" variant="outline" size="sm" onClick={() => setIsNewStockItem(prev => !prev)}>
                                                {isNewStockItem ? 'Select Existing' : 'Add New Item'}
                                            </Button>
                                        </div>
                                    ) : (
                                        <Controller
                                            control={control}
                                            name="stockItemName"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger><SelectValue placeholder="Select item to sell" /></SelectTrigger>
                                                    <SelectContent>
                                                        {stockItems.filter(i => i.weight > 0).map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    )}
                                    {errors.stockItemName && <p className="text-sm text-destructive">{errors.stockItemName.message}</p>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Weight (kg)</Label>
                                        <Input type="number" step="0.01" {...register('weight')} placeholder="0.00"/>
                                        {errors.weight && <p className="text-sm text-destructive">{errors.weight.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Price per kg</Label>
                                        <Input type="number" step="0.01" {...register('pricePerKg')} placeholder="0.00"/>
                                        {errors.pricePerKg && <p className="text-sm text-destructive">{errors.pricePerKg.message}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Payment Method</Label>
                                    <Controller 
                                        control={control}
                                        name="paymentMethod"
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                                                <Label htmlFor="cash-payment" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" id="cash-payment" /><span>Cash</span></Label>
                                                <Label htmlFor="bank-payment" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" id="bank-payment" /><span>Bank</span></Label>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                                </div>
                            </TabsContent>

                            <TabsContent value="transfer" className="m-0 space-y-4 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        {dateField}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amount-transfer">Amount</Label>
                                        <Input id="amount-transfer" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                                        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Transfer Direction</Label>
                                    <Controller 
                                        control={control}
                                        name="transferFrom"
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                                                <Label htmlFor="from_cash" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" id="from_cash" /><span>Cash to Bank</span></Label>
                                                <Label htmlFor="from_bank" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" id="from_bank" /><span>Bank to Cash</span></Label>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.transferFrom && <p className="text-sm text-destructive">{errors.transferFrom.message}</p>}
                                </div>
                            </TabsContent>
                        </div>

                        {transactionType && (
                            <div className="space-y-4 pt-4 animate-fade-in">
                                <Separator />
                                {(transactionType === 'cash' || transactionType === 'bank' || transactionType === 'stock') && (
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Input id="description" {...register('description')} placeholder={transactionType === 'stock' ? "Optional notes (e.g., invoice #)" : "e.g., Weekly groceries"} />
                                        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                                    </div>
                                )}
                                
                            </div>
                        )}
                        <div className="flex justify-end pt-6">
                            <Button type="submit" className="w-full sm:w-auto" disabled={!transactionType}>Record Transaction</Button>
                        </div>
                    </form>
                </Tabs>
            )}
        />
    </>
  );
}
