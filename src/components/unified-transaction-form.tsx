
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
import { CalendarIcon, Plus, PlusCircle, Wallet, Landmark, Boxes, ArrowRightLeft, UserPlus } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

const formSchema = z.object({
  transactionType: z.enum(['cash', 'bank', 'stock', 'transfer', 'ap_ar']),
  amount: z.coerce.number().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  date: z.date(),
  
  // stock specific
  stockType: z.enum(['purchase', 'sale']).optional(),
  stockItemName: z.string().optional(),
  weight: z.coerce.number().optional(),
  pricePerKg: z.coerce.number().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'credit']).optional(),

  // cash/bank specific
  inOutType: z.enum(['in', 'out']).optional(),

  // transfer specific
  transferFrom: z.enum(['cash', 'bank']).optional(),

  // A/R A/P specific
  ledgerType: z.enum(['payable', 'receivable']).optional(),
  contact_id: z.string().optional(),
  newContact: z.string().optional(),


}).superRefine((data, ctx) => {
    if (data.transactionType === 'stock') {
        if (!data.stockType) ctx.addIssue({ code: 'custom', message: 'Please select purchase or sale.', path: ['stockType'] });
        if (!data.stockItemName) ctx.addIssue({ code: 'custom', message: 'Stock item name is required.', path: ['stockItemName'] });
        if (!data.weight || data.weight <= 0) ctx.addIssue({ code: 'custom', message: 'Weight must be positive.', path: ['weight'] });
        if (data.pricePerKg === undefined || data.pricePerKg < 0) ctx.addIssue({ code: 'custom', message: 'Price must be non-negative.', path: ['pricePerKg'] });
        if (!data.paymentMethod) ctx.addIssue({ code: 'custom', message: 'Payment method is required.', path: ['paymentMethod'] });
        if (data.paymentMethod === 'credit') {
            if (data.contact_id === 'new' && !data.newContact) {
                const contactType = data.stockType === 'purchase' ? 'Vendor' : 'Client';
                ctx.addIssue({ code: 'custom', message: `New ${contactType} name is required.`, path: ['newContact'] });
            }
            if (data.contact_id !== 'new' && !data.contact_id) {
                const contactType = data.stockType === 'purchase' ? 'Vendor' : 'Client';
                ctx.addIssue({ code: 'custom', message: `Please select a ${contactType}.`, path: ['contact_id'] });
            }
        }
    }
    if (['cash', 'bank', 'transfer', 'ap_ar'].includes(data.transactionType)) {
        if(!data.amount || data.amount <=0) ctx.addIssue({ code: 'custom', message: 'Amount must be positive.', path: ['amount'] });
    }
    if(data.transactionType === 'cash' || data.transactionType === 'bank') {
        if (!data.inOutType) ctx.addIssue({ code: 'custom', message: 'Transaction direction is required.', path: ['inOutType'] });
        if (!data.category) ctx.addIssue({ code: 'custom', message: 'Category is required.', path: ['category'] });
        if (!data.description) ctx.addIssue({ code: 'custom', message: 'Description is required.', path: ['description'] });
    }
    if(data.transactionType === 'transfer') {
        if (!data.transferFrom) ctx.addIssue({ code: 'custom', message: 'Transfer source is required.', path: ['transferFrom'] });
    }
    if(data.transactionType === 'ap_ar') {
        if (!data.ledgerType) ctx.addIssue({ code: 'custom', message: 'Please select Payable or Receivable.', path: ['ledgerType'] });
        if (!data.description) ctx.addIssue({ code: 'custom', message: 'Description is required.', path: ['description'] });
        if (data.contact_id === 'new' && !data.newContact) {
            ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
        }
        if (data.contact_id !== 'new' && !data.contact_id) {
            ctx.addIssue({ code: 'custom', message: 'Please select a contact.', path: ['contact_id'] });
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
    addLedgerTransaction,
    addVendor,
    addClient,
    transferFunds,
    cashCategories,
    bankCategories,
    stockItems,
    vendors,
    clients,
  } = useAppContext();
  
  const { toast } = useToast();
  
  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
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
  const stockPaymentMethod = watch('paymentMethod');
  const ledgerType = watch('ledgerType');
  const contact_id = watch('contact_id');
  const [isNewStockItem, setIsNewStockItem] = useState(false);

  useEffect(() => {
    reset({
        date: new Date(),
        amount: undefined,
        description: "",
        transactionType: transactionType as any
    });
    setIsNewStockItem(false);
  }, [transactionType, reset]);
  
  useEffect(() => {
    // Clear contact selection when stock type changes
    setValue('contact_id', undefined);
    setValue('newContact', '');
  }, [stockType, setValue]);

  useEffect(() => {
    setValue('contact_id', undefined);
    setValue('newContact', '');
  }, [ledgerType, setValue]);

  const onSubmit = async (data: FormData) => {
    const transactionDate = data.date.toISOString();
    try {
        switch(data.transactionType) {
            case 'cash':
                await addCashTransaction({
                    type: data.inOutType === 'in' ? 'income' : 'expense',
                    amount: data.amount!,
                    description: data.description!,
                    category: data.category!,
                    date: transactionDate,
                });
                break;
            case 'bank':
                 await addBankTransaction({
                    type: data.inOutType === 'in' ? 'deposit' : 'withdrawal',
                    amount: data.amount!,
                    description: data.description!,
                    category: data.category!,
                    date: transactionDate,
                });
                break;
            case 'stock':
                let stockContactId: string | undefined;
                
                if (data.paymentMethod === 'credit') {
                    if (data.contact_id === 'new') {
                        const newContact = data.stockType === 'purchase' ? await addVendor(data.newContact!) : await addClient(data.newContact!);
                        if(!newContact) throw new Error(`Failed to create new ${data.stockType === 'purchase' ? 'vendor' : 'client'}.`);
                        stockContactId = newContact.id;
                    } else {
                        stockContactId = data.contact_id;
                    }
                }
                
                await addStockTransaction({
                    type: data.stockType!,
                    stockItemName: data.stockItemName!,
                    weight: data.weight!,
                    pricePerKg: data.pricePerKg!,
                    paymentMethod: data.paymentMethod!,
                    description: data.description,
                    date: transactionDate,
                    contact_id: stockContactId,
                });
                break;
            case 'transfer':
                await transferFunds(data.transferFrom!, data.amount!, transactionDate);
                break;
            case 'ap_ar':
                let finalContactId = data.contact_id!;
                if(data.contact_id === 'new') {
                    const newContact = data.ledgerType === 'payable' ? await addVendor(data.newContact!) : await addClient(data.newContact!);
                    if(!newContact) throw new Error(`Failed to create new ${data.ledgerType === 'payable' ? 'vendor' : 'client'}.`);
                    finalContactId = newContact.id;
                }

                await addLedgerTransaction({
                    type: data.ledgerType!,
                    description: data.description!,
                    amount: data.amount!,
                    date: transactionDate,
                    contact_id: finalContactId,
                });
                break;
        }
        toast({ title: "Transaction Added", description: "Your transaction has been successfully recorded." });
        reset();
        setDialogOpen(false);
    } catch(error: any) {
         toast({ variant: "destructive", title: "Operation Failed", description: error.message || "An unexpected error occurred." });
    }
  };

  const currentCategories = transactionType === 'cash' ? cashCategories : bankCategories;
  const stockCreditContactType = stockType === 'purchase' ? 'Vendor' : 'Client';
  const stockCreditContacts = stockType === 'purchase' ? vendors : clients;
  
  const currentLedgerContacts = ledgerType === 'payable' ? vendors : clients;
  
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

  const stockCreditFields = (
     <div className="space-y-2 animate-fade-in pt-2">
        <Separator />
         <Alert variant="default" className="mt-4 bg-blue-50 border-blue-200 text-blue-800">
            <AlertTitle>On Credit</AlertTitle>
            <AlertDescription>
                This will create a new item in your Accounts {stockType === 'purchase' ? 'Payable' : 'Receivable'} ledger.
            </AlertDescription>
        </Alert>
        <Label>{stockCreditContactType}</Label>
        <Controller
            control={control}
            name="contact_id"
            render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                        <SelectValue placeholder={`Select a ${stockCreditContactType}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {stockCreditContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        <SelectItem value="new">
                          <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>
                        </SelectItem>
                    </SelectContent>
                </Select>
            )}
        />
        {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
    
        {contact_id === 'new' && (
            <div className="flex items-end gap-2 pt-2 animate-fade-in">
                <div className="flex-grow space-y-1">
                    <Label htmlFor="newContact">New {stockCreditContactType} Name</Label>
                    <Input {...register('newContact')} placeholder={`Enter new ${stockCreditContactType.toLowerCase()} name`}/>
                </div>
            </div>
        )}
        {errors.newContact && <p className="text-sm text-destructive">{errors.newContact.message}</p>}
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
                    <TabsList className="grid w-full grid-cols-5 h-auto">
                        <TabsTrigger value="cash"><Wallet className="mr-1 h-4 w-4" />Cash</TabsTrigger>
                        <TabsTrigger value="bank"><Landmark className="mr-1 h-4 w-4" />Bank</TabsTrigger>
                        <TabsTrigger value="stock"><Boxes className="mr-1 h-4 w-4" />Stock</TabsTrigger>
                        <TabsTrigger value="transfer"><ArrowRightLeft className="mr-1 h-4 w-4" />Transfer</TabsTrigger>
                        <TabsTrigger value="ap_ar"><UserPlus className="mr-1 h-4 w-4" />A/R & A/P</TabsTrigger>
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
                                                <Label htmlFor="credit-payment" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="credit" id="credit-payment" /><span>Credit</span></Label>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                                </div>
                                {stockPaymentMethod === 'credit' && stockType && stockCreditFields}
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

                             <TabsContent value="ap_ar" className="m-0 space-y-4 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        {dateField}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amount-ledger">Amount</Label>
                                        <Input id="amount-ledger" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                                        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Controller 
                                        control={control}
                                        name="ledgerType"
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                                                <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="payable" />Payable (Expense on Credit)</Label>
                                                <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="receivable" />Receivable (Sale on Credit)</Label>
                                            </RadioGroup>
                                        )}
                                    />
                                    {errors.ledgerType && <p className="text-sm text-destructive">{errors.ledgerType.message}</p>}
                                </div>

                                {ledgerType && (
                                    <div className="space-y-2 animate-fade-in">
                                        <Label>{ledgerType === 'payable' ? 'Vendor' : 'Client'}</Label>
                                        <Controller
                                            control={control}
                                            name="contact_id"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={`Select a ${ledgerType === 'payable' ? 'Vendor' : 'Client'}`} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {currentLedgerContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                        <SelectItem value="new">
                                                          <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
                                    
                                        {contact_id === 'new' && (
                                            <div className="flex items-end gap-2 pt-2 animate-fade-in">
                                                <div className="flex-grow space-y-1">
                                                    <Label htmlFor="newContact">New {ledgerType === 'payable' ? 'Vendor' : 'Client'} Name</Label>
                                                    <Input {...register('newContact')} placeholder={`Enter new ${ledgerType === 'payable' ? 'vendor' : 'client'} name`}/>
                                                </div>
                                            </div>
                                        )}
                                        {errors.newContact && <p className="text-sm text-destructive">{errors.newContact.message}</p>}
                                    </div>
                                )}
                            </TabsContent>
                        </div>

                        {(transactionType && transactionType !== 'transfer') && (
                            <div className="space-y-4 pt-4 animate-fade-in">
                                <Separator />
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input id="description" {...register('description')} placeholder={
                                        transactionType === 'stock' ? "Optional notes (e.g., invoice #)" :
                                        "e.g., Weekly groceries"
                                    } />
                                    {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end pt-6">
                            <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || !transactionType}>
                                {isSubmitting && <PlusCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Record Transaction
                            </Button>
                        </div>
                    </form>
                </Tabs>
            )}
        />
    </>
  );
}
