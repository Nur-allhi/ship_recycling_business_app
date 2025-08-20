
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppContext } from '@/app/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveSelect } from '@/components/ui/responsive-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CalendarIcon, Plus, PlusCircle, Wallet, Landmark, Boxes, ArrowRightLeft, UserPlus, Loader2 } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { useIsMobile } from '@/hooks/use-mobile';


const formSchema = z.object({
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
  bank_id: z.string().optional(),

  // transfer specific
  transferFrom: z.enum(['cash', 'bank']).optional(),
  transferToBankId: z.string().optional(),
  transferFromBankId: z.string().optional(),


  // A/R A/P or Stock-on-credit or Bank-settlement specific
  contact_id: z.string().optional(),
  newContact: z.string().optional(),

  // A/R A/P specific
  ledgerType: z.enum(['payable', 'receivable']).optional(),


}).superRefine((data, ctx) => {
    // This superRefine is now less critical as we switch form schemas, but kept for safety.
});


type FormData = z.infer<typeof formSchema>;

interface UnifiedTransactionFormProps {
  setDialogOpen: (open: boolean) => void;
}

const baseSchema = z.object({
    date: z.date({ required_error: "Date is required." }),
});

const cashSchema = baseSchema.extend({
    amount: z.coerce.number().optional(),
    category: z.string({ required_error: "Category is required." }),
    description: z.string().optional(),
    stockItemName: z.string().optional(),
    weight: z.coerce.number().optional(),
    pricePerKg: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.category === 'Stock Purchase' || data.category === 'Stock Sale') {
        if (!data.stockItemName) ctx.addIssue({ code: 'custom', message: 'Item name is required.', path: ['stockItemName'] });
        if (!data.weight || data.weight <= 0) ctx.addIssue({ code: 'custom', message: 'Weight must be positive.', path: ['weight'] });
        if (!data.pricePerKg || data.pricePerKg < 0) ctx.addIssue({ code: 'custom', message: 'Price must be positive.', path: ['pricePerKg'] });
    } else {
        if (!data.amount || data.amount <= 0) ctx.addIssue({ code: 'custom', message: 'Amount must be positive.', path: ['amount']});
        if (!data.description || data.description.length === 0) ctx.addIssue({ code: 'custom', message: 'Description is required.', path: ['description']});
    }
});


const bankSchema = baseSchema.extend({
    amount: z.coerce.number().optional(),
    bank_id: z.string({ required_error: "Bank account is required." }),
    category: z.string({ required_error: "Category is required." }),
    description: z.string().optional(),
    contact_id: z.string().optional(),
    stockItemName: z.string().optional(),
    weight: z.coerce.number().optional(),
    pricePerKg: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.category === 'A/R Settlement' || data.category === 'A/P Settlement') {
        if (!data.contact_id) {
           ctx.addIssue({ code: 'custom', message: `A contact is required for settlements.`, path: ['contact_id'] });
        }
        if (!data.amount || data.amount <= 0) ctx.addIssue({ code: 'custom', message: 'Amount must be positive.', path: ['amount']});
    } else if (data.category === 'Stock Purchase' || data.category === 'Stock Sale') {
        if (!data.stockItemName) ctx.addIssue({ code: 'custom', message: 'Item name is required.', path: ['stockItemName'] });
        if (!data.weight || data.weight <= 0) ctx.addIssue({ code: 'custom', message: 'Weight must be positive.', path: ['weight'] });
        if (!data.pricePerKg || data.pricePerKg < 0) ctx.addIssue({ code: 'custom', message: 'Price must be positive.', path: ['pricePerKg'] });
    } else {
        if (!data.amount || data.amount <= 0) ctx.addIssue({ code: 'custom', message: 'Amount must be positive.', path: ['amount']});
        if (!data.description || data.description.length === 0) {
            ctx.addIssue({ code: 'custom', message: `Description is required for this category.`, path: ['description'] });
        }
    }
});


const stockSchema = baseSchema.extend({
    stockType: z.enum(['purchase', 'sale'], { required_error: "Please select purchase or sale."}),
    stockItemName: z.string({ required_error: "Item name is required." }),
    weight: z.coerce.number().positive(),
    pricePerKg: z.coerce.number().nonnegative(),
    paymentMethod: z.enum(['cash', 'bank', 'credit'], { required_error: "Payment method is required." }),
    description: z.string().optional(),
    bank_id: z.string().optional(),
    contact_id: z.string().optional(),
    newContact: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.paymentMethod === 'bank' && !data.bank_id) {
        ctx.addIssue({ code: 'custom', message: 'Bank account is required.', path: ['bank_id'] });
    }
    if (data.paymentMethod === 'credit') {
        if (!data.contact_id) {
            ctx.addIssue({ code: 'custom', message: 'A contact is required for credit transactions.', path: ['contact_id'] });
        }
        if (data.contact_id === 'new' && (!data.newContact || data.newContact.trim().length === 0)) {
            ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
        }
    }
});

const transferSchema = baseSchema.extend({
    amount: z.coerce.number().positive(),
    transferFrom: z.enum(['cash', 'bank'], { required_error: "Please select transfer source."}),
    transferToBankId: z.string().optional(),
    transferFromBankId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.transferFrom === 'cash' && !data.transferToBankId) {
        ctx.addIssue({ code: 'custom', message: 'Destination bank is required.', path: ['transferToBankId'] });
    }
    if (data.transferFrom === 'bank' && !data.transferFromBankId) {
        ctx.addIssue({ code: 'custom', message: 'Source bank is required.', path: ['transferFromBankId'] });
    }
});

const apArSchema = baseSchema.extend({
    amount: z.coerce.number().positive(),
    ledgerType: z.enum(['payable', 'receivable'], { required_error: "Please select payable or receivable." }),
    contact_id: z.string({ required_error: "A contact is required." }),
    newContact: z.string().optional(),
    description: z.string().min(1, "Description is required."),
}).superRefine((data, ctx) => {
    if (data.contact_id === 'new' && (!data.newContact || data.newContact.trim().length === 0)) {
        ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
    }
});


const formSchemas = {
    cash: cashSchema,
    bank: bankSchema,
    stock: stockSchema,
    transfer: transferSchema,
    ap_ar: apArSchema,
};

type TransactionType = keyof typeof formSchemas;

export function UnifiedTransactionForm({ setDialogOpen }: UnifiedTransactionFormProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>('cash');
  const isMobile = useIsMobile();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
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
    banks,
    reloadData,
  } = useAppContext();
  
  const currentSchema = formSchemas[transactionType];

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(currentSchema),
    defaultValues: {
        date: new Date(),
    }
  });
  
  // Watch for changes in fields that affect other parts of the form
  const stockType = watch('stockType');
  const stockPaymentMethod = watch('paymentMethod');
  const ledgerType = watch('ledgerType');
  const contact_id = watch('contact_id');
  const transferFrom = watch('transferFrom');
  const cashCategoryName = watch('category');
  const bankCategoryName = watch('category');
  const [isNewStockItem, setIsNewStockItem] = useState(false);

  useEffect(() => {
    reset({
        date: new Date(),
    });
    setIsNewStockItem(false);
  }, [transactionType, reset]);
  
  useEffect(() => {
    setValue('contact_id', undefined);
    setValue('newContact', '');
  }, [stockType, ledgerType, bankCategoryName, setValue]);

  const onSubmit = async (data: any) => {
    const transactionDate = data.date.toISOString();
    try {
        switch(transactionType) {
            case 'cash': {
                const category = cashCategories.find(c => c.name === data.category);
                if (!category || !category.direction) throw new Error("Selected category is invalid.");
                
                if (data.category === 'Stock Purchase' || data.category === 'Stock Sale') {
                    await addStockTransaction({
                        type: data.category === 'Stock Purchase' ? 'purchase' : 'sale',
                        stockItemName: data.stockItemName,
                        weight: data.weight,
                        pricePerKg: data.pricePerKg,
                        paymentMethod: 'cash',
                        description: `From cash transaction: ${data.category}`,
                        date: transactionDate,
                    });
                } else {
                    await addCashTransaction({
                        type: category.direction === 'credit' ? 'income' : 'expense',
                        amount: data.amount!,
                        description: data.description!,
                        category: data.category!,
                        date: transactionDate,
                    });
                }
                break;
            }
            case 'bank': {
                 const selectedCategory = bankCategories.find(c => c.name === data.category);
                 if(!selectedCategory) throw new Error("Could not find a valid direction for the selected category.");

                if (data.category === 'Stock Purchase' || data.category === 'Stock Sale') {
                     await addStockTransaction({
                        type: data.category === 'Stock Purchase' ? 'purchase' : 'sale',
                        stockItemName: data.stockItemName,
                        weight: data.weight,
                        pricePerKg: data.pricePerKg,
                        paymentMethod: 'bank',
                        bank_id: data.bank_id,
                        description: `From bank transaction: ${data.category}`,
                        date: transactionDate,
                    });
                } else if (data.category === 'A/R Settlement' || data.category === 'A/P Settlement') {
                    let contactName: string | undefined;
                    if (data.category === 'A/R Settlement') {
                        contactName = clients.find(c => c.id === data.contact_id)?.name;
                    } else {
                        contactName = vendors.find(v => v.id === data.contact_id)?.name;
                    }
                    if(!contactName) throw new Error("Contact not found for settlement.");
                    
                    await addBankTransaction({
                        type: selectedCategory.direction === 'credit' ? 'deposit' : 'withdrawal',
                        amount: data.amount!,
                        description: `Settlement for ${contactName}`,
                        category: data.category!,
                        date: transactionDate,
                        bank_id: data.bank_id!,
                    }, data.contact_id, contactName);

                } else {
                    await addBankTransaction({
                        type: selectedCategory.direction === 'credit' ? 'deposit' : 'withdrawal',
                        amount: data.amount!,
                        description: data.description!,
                        category: data.category!,
                        date: transactionDate,
                        bank_id: data.bank_id!,
                    });
                }
                break;
            }
            case 'stock':
                let stockContactId: string | undefined;
                let stockContactName: string | undefined;
                if (data.paymentMethod === 'credit') {
                    if (data.contact_id === 'new') {
                        const newContact = data.stockType === 'purchase' ? await addVendor(data.newContact!) : await addClient(data.newContact!);
                        if (!newContact) throw new Error(`Failed to create new ${data.stockType === 'purchase' ? 'vendor' : 'client'}.`);
                        stockContactId = newContact.id;
                        stockContactName = newContact.name;
                    } else {
                        stockContactId = data.contact_id;
                    }
                    if (!stockContactId) throw new Error("Contact ID is required for credit transaction.");
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
                    contact_name: stockContactName,
                    bank_id: data.bank_id,
                });
                break;
            case 'transfer':
                const bankId = data.transferFrom === 'cash' ? data.transferToBankId : data.transferFromBankId;
                if (!bankId) throw new Error("A bank account must be selected for the transfer.");
                await transferFunds(data.transferFrom!, data.amount!, transactionDate, bankId);
                break;
            case 'ap_ar':
                let ledgerContactId: string | undefined;
                let ledgerContactName: string | undefined;
                const contactType = data.ledgerType === 'payable' ? 'vendor' : 'client';
                const contactList = data.ledgerType === 'payable' ? vendors : clients;

                if (data.contact_id === 'new') {
                    const newContact = await (data.ledgerType === 'payable' ? addVendor(data.newContact!) : await addClient(data.newContact!));
                    if (!newContact) throw new Error(`Failed to create new ${contactType}.`);
                    ledgerContactId = newContact.id;
                    ledgerContactName = newContact.name;
                } else {
                    ledgerContactId = data.contact_id;
                    ledgerContactName = contactList.find(c => c.id === ledgerContactId)?.name;
                }
                
                if(!ledgerContactId || !ledgerContactName) {
                    throw new Error("A contact is required for this transaction.");
                }

                await addLedgerTransaction({
                    type: data.ledgerType!,
                    description: data.description!,
                    amount: data.amount!,
                    date: transactionDate,
                    contact_id: ledgerContactId,
                    contact_name: ledgerContactName,
                });
                break;
        }
        toast.success("Transaction Added", { description: "Your transaction has been successfully recorded." });
        setDialogOpen(false);
    } catch(error: any) {
         toast.error("Operation Failed", { description: error.message || "An unexpected error occurred." });
    }
  };

  const stockCreditContactType = stockType === 'purchase' ? 'Vendor' : 'Client';
  const stockCreditContacts = stockType === 'purchase' ? vendors : clients;
  
  const currentLedgerContactType = ledgerType === 'payable' ? 'Vendor' : 'Client';
  const currentLedgerContacts = ledgerType === 'payable' ? vendors : clients;
  
  const dateField = (
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Controller
            control={control}
            name="date"
            render={({ field }) => (
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
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
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                field.onChange(date);
                                setIsDatePickerOpen(false);
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            )}
        />
        {errors.date && <p className="text-sm text-destructive">{(errors.date as any).message}</p>}
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
                <ResponsiveSelect 
                    onValueChange={field.onChange} 
                    value={field.value}
                    title={`Select a ${stockCreditContactType}`}
                    placeholder={`Select a ${stockCreditContactType}`}
                    items={
                        [
                            ...stockCreditContacts.map(c => ({ value: c.id, label: c.name })),
                            { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>}
                        ]
                    }
                />
            )}
        />
        {errors.contact_id && <p className="text-sm text-destructive">{(errors.contact_id as any).message}</p>}
    
        {contact_id === 'new' && (
            <div className="flex items-end gap-2 pt-2 animate-fade-in">
                <div className="flex-grow space-y-1">
                    <Label htmlFor="newContact">New {stockCreditContactType} Name</Label>
                    <Input {...register('newContact')} placeholder={`Enter new ${stockCreditContactType.toLowerCase()} name`}/>
                </div>
            </div>
        )}
        {errors.newContact && <p className="text-sm text-destructive">{(errors.newContact as any).message}</p>}
    </div>
  )
  
  const cashCategoryItems = useMemo(() => cashCategories.filter(c => c.direction).map(c => ({ value: c.name, label: `${c.name} (${c.direction})` })), [cashCategories]);
  const bankCategoryItems = useMemo(() => bankCategories.map(c => ({ value: c.name, label: `${c.name} (${c.direction ? c.direction : 'Settlement'})` })), [bankCategories]);
  const bankAccountItems = useMemo(() => banks.map(b => ({ value: b.id, label: b.name })), [banks]);
  const stockItemsForSale = useMemo(() => stockItems.filter(i => i.weight > 0).map(item => ({ value: item.name, label: item.name })), [stockItems]);
  const stockItemsForPurchase = useMemo(() => stockItems.map(item => ({ value: item.name, label: item.name })), [stockItems]);
  const vendorContactItems = useMemo(() => [
      ...vendors.map(c => ({ value: c.id, label: c.name })), 
      { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>}
  ], [vendors]);
  const clientContactItems = useMemo(() => [
    ...clients.map(c => ({ value: c.id, label: c.name })), 
    { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>}
  ], [clients]);
  const currentLedgerContactItems = ledgerType === 'payable' ? vendorContactItems : clientContactItems;

  const stockFields = (
    <div className="space-y-4 animate-fade-in">
        <Separator className="my-4"/>
         <div className="space-y-2">
            <Label>Item Name</Label>
            {(cashCategoryName === 'Stock Purchase' || bankCategoryName === 'Stock Purchase') ? (
                <div className="flex items-center gap-2">
                    {isNewStockItem ? (
                        <Input {...register('stockItemName')} placeholder="e.g. Iron Rod"/>
                    ) : (
                        <Controller
                            control={control}
                            name="stockItemName"
                            render={({ field }) => (
                                <ResponsiveSelect
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    title="Select an item"
                                    placeholder="Select existing item"
                                    className="flex-1"
                                    items={stockItemsForPurchase}
                                />
                            )}
                        />
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsNewStockItem(prev => !prev)}>
                        {isNewStockItem ? 'Select Existing' : 'Add New'}
                    </Button>
                </div>
            ) : (
                <Controller
                    control={control}
                    name="stockItemName"
                    render={({ field }) => (
                        <ResponsiveSelect
                            onValueChange={field.onChange}
                            value={field.value}
                            title="Select an item"
                            placeholder="Select item to sell"
                            items={stockItemsForSale}
                        />
                    )}
                />
            )}
            {errors.stockItemName && <p className="text-sm text-destructive">{(errors.stockItemName as any).message}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.01" {...register('weight')} placeholder="0.00"/>
                {errors.weight && <p className="text-sm text-destructive">{(errors.weight as any).message}</p>}
            </div>
            <div className="space-y-2">
                <Label>Price per kg</Label>
                <Input type="number" step="0.01" {...register('pricePerKg')} placeholder="0.00"/>
                {errors.pricePerKg && <p className="text-sm text-destructive">{(errors.pricePerKg as any).message}</p>}
            </div>
        </div>
    </div>
  )
  
  const transactionTypeItems: {value: TransactionType, label: string, icon: React.ElementType}[] = [
      { value: 'cash', label: 'Cash', icon: Wallet },
      { value: 'bank', label: 'Bank', icon: Landmark },
      { value: 'stock', label: 'Stock', icon: Boxes },
      { value: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
      { value: 'ap_ar', label: 'A/R & A/P', icon: UserPlus },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center"><PlusCircle className="mr-2 h-6 w-6" /> Add a New Transaction</DialogTitle>
        <DialogDescription>Select a transaction type and fill in the details below.</DialogDescription>
      </DialogHeader>
      
      <div className="py-4">
        {isMobile ? (
             <ResponsiveSelect 
                value={transactionType}
                onValueChange={(value) => setTransactionType(value as TransactionType)}
                title="Select Transaction Type"
                items={transactionTypeItems.map(item => ({value: item.value, label: <span className="flex items-center gap-2"><item.icon className="h-4 w-4" />{item.label}</span>}))}
            />
        ) : (
            <Tabs value={transactionType} onValueChange={(value) => setTransactionType(value as TransactionType)} className="w-full">
                <TabsList className="w-full grid grid-cols-5">
                     {transactionTypeItems.map(item => (
                        <TabsTrigger key={item.value} value={item.value}><item.icon className="mr-1 h-4 w-4" />{item.label}</TabsTrigger>
                     ))}
                </TabsList>
            </Tabs>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
              {transactionType === 'cash' && (
                  <div className="m-0 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">{dateField}</div>
                        {(cashCategoryName !== 'Stock Purchase' && cashCategoryName !== 'Stock Sale') && (
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input id="amount" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                                {errors.amount && <p className="text-sm text-destructive">{(errors.amount as any).message}</p>}
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Controller
                            control={control}
                            name="category"
                            render={({ field }) => (
                                <ResponsiveSelect 
                                    onValueChange={field.onChange} 
                                    value={field.value}
                                    title="Select a category"
                                    placeholder="Select a category"
                                    items={cashCategoryItems}
                                />
                            )}
                        />
                        {errors.category && <p className="text-sm text-destructive">{(errors.category as any).message}</p>}
                    </div>
                    {(cashCategoryName !== 'Stock Purchase' && cashCategoryName !== 'Stock Sale') && (
                        <div className="space-y-2">
                            <Label htmlFor="description-cash">Description</Label>
                            <Input id="description-cash" {...register('description')} placeholder="e.g., Weekly groceries" />
                            {errors.description && <p className="text-sm text-destructive">{(errors.description as any).message}</p>}
                        </div>
                    )}
                    {(cashCategoryName === 'Stock Purchase' || cashCategoryName === 'Stock Sale') && stockFields}
                  </div>
              )}

              {transactionType === 'bank' && (
                  <div className="m-0 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="md:col-span-2">{dateField}</div>
                         <div className="space-y-2">
                            <Label>Bank Account</Label>
                            <Controller
                                control={control}
                                name="bank_id"
                                render={({ field }) => (
                                    <ResponsiveSelect 
                                        onValueChange={field.onChange} 
                                        value={field.value}
                                        title="Select a bank account"
                                        placeholder="Select a bank account"
                                        items={bankAccountItems}
                                    />
                                )}
                            />
                            {errors.bank_id && <p className="text-sm text-destructive">{(errors.bank_id as any).message}</p>}
                        </div>
                        {(bankCategoryName !== 'Stock Purchase' && bankCategoryName !== 'Stock Sale') && (
                           <div className="space-y-2">
                                <Label htmlFor="amount-bank">Amount</Label>
                                <Input id="amount-bank" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                                {errors.amount && <p className="text-sm text-destructive">{(errors.amount as any).message}</p>}
                            </div>
                        )}
                    </div>
                        <div className="space-y-2">
                        <Label>Category</Label>
                        <Controller
                            control={control}
                            name="category"
                            render={({ field }) => (
                                <ResponsiveSelect
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    title="Select a category"
                                    placeholder="Select a category"
                                    items={bankCategoryItems}
                                />
                            )}
                        />
                        {errors.category && <p className="text-sm text-destructive">{(errors.category as any).message}</p>}
                    </div>
                    {bankCategoryName === 'A/R Settlement' && (
                            <div className="space-y-2 animate-fade-in">
                            <Label>Client</Label>
                            <Controller
                                control={control}
                                name="contact_id"
                                render={({ field }) => (
                                    <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select a Client" placeholder="Select a client" items={clientContactItems.filter(c => c.value !== 'new')} />
                                )}
                            />
                            {errors.contact_id && <p className="text-sm text-destructive">{(errors.contact_id as any).message}</p>}
                        </div>
                    )}
                    {bankCategoryName === 'A/P Settlement' && (
                            <div className="space-y-2 animate-fade-in">
                            <Label>Vendor</Label>
                            <Controller
                                control={control}
                                name="contact_id"
                                render={({ field }) => (
                                    <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select a Vendor" placeholder="Select a vendor" items={vendorContactItems.filter(c => c.value !== 'new')} />
                                )}
                            />
                            {errors.contact_id && <p className="text-sm text-destructive">{(errors.contact_id as any).message}</p>}
                        </div>
                    )}
                    {(bankCategoryName !== 'A/R Settlement' && bankCategoryName !== 'A/P Settlement' && bankCategoryName !== 'Stock Purchase' && bankCategoryName !== 'Stock Sale') && (
                        <div className="space-y-2">
                            <Label htmlFor="description-bank">Description</Label>
                            <Input id="description-bank" {...register('description')} placeholder="e.g., Monthly salary" />
                            {errors.description && <p className="text-sm text-destructive">{(errors.description as any).message}</p>}
                        </div>
                    )}
                     {(bankCategoryName === 'Stock Purchase' || bankCategoryName === 'Stock Sale') && stockFields}
                  </div>
              )}
              
              {transactionType === 'stock' && (
                  <div className="m-0 space-y-4 animate-fade-in">
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
                        {errors.stockType && <p className="text-sm text-destructive">{(errors.stockType as any).message}</p>}
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
                                            <ResponsiveSelect
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                title="Select an item"
                                                placeholder="Select existing item"
                                                className="flex-1"
                                                items={stockItemsForPurchase}
                                            />
                                        )}
                                    />
                                )}
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsNewStockItem(prev => !prev)}>
                                    {isNewStockItem ? 'Select Existing' : 'Add New'}
                                </Button>
                            </div>
                        ) : (
                            <Controller
                                control={control}
                                name="stockItemName"
                                render={({ field }) => (
                                    <ResponsiveSelect
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        title="Select an item"
                                        placeholder="Select item to sell"
                                        items={stockItemsForSale}
                                    />
                                )}
                            />
                        )}
                        {errors.stockItemName && <p className="text-sm text-destructive">{(errors.stockItemName as any).message}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Weight (kg)</Label>
                            <Input type="number" step="0.01" {...register('weight')} placeholder="0.00"/>
                            {errors.weight && <p className="text-sm text-destructive">{(errors.weight as any).message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Price per kg</Label>
                            <Input type="number" step="0.01" {...register('pricePerKg')} placeholder="0.00"/>
                            {errors.pricePerKg && <p className="text-sm text-destructive">{(errors.pricePerKg as any).message}</p>}
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
                        {errors.paymentMethod && <p className="text-sm text-destructive">{(errors.paymentMethod as any).message}</p>}
                    </div>
                    {stockPaymentMethod === 'bank' && (
                        <div className="space-y-2 animate-fade-in">
                        <Label>Bank Account</Label>
                        <Controller
                            control={control}
                            name="bank_id"
                            render={({ field }) => (
                                <ResponsiveSelect 
                                    onValueChange={field.onChange} 
                                    value={field.value}
                                    title="Select a bank account"
                                    placeholder="Select a bank account"
                                    items={bankAccountItems}
                                />
                            )}
                        />
                        {errors.bank_id && <p className="text-sm text-destructive">{(errors.bank_id as any).message}</p>}
                    </div>
                    )}
                    {stockPaymentMethod === 'credit' && stockType && stockCreditFields}
                    <div className="space-y-2">
                        <Label htmlFor="description-stock">Description</Label>
                        <Input id="description-stock" {...register('description')} placeholder="Optional notes (e.g., invoice #)" />
                        {errors.description && <p className="text-sm text-destructive">{(errors.description as any).message}</p>}
                    </div>
                  </div>
              )}

              {transactionType === 'transfer' && (
                  <div className="m-0 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            {dateField}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount-transfer">Amount</Label>
                            <Input id="amount-transfer" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                            {errors.amount && <p className="text-sm text-destructive">{(errors.amount as any).message}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Transfer Direction</Label>
                        <Controller 
                            control={control}
                            name="transferFrom"
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row pt-2 gap-4">
                                    <Label htmlFor="from_cash" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" id="from_cash" /><span>Cash to Bank</span></Label>
                                    <Label htmlFor="from_bank" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" id="from_bank" /><span>Bank to Cash</span></Label>
                                </RadioGroup>
                            )}
                        />
                        {errors.transferFrom && <p className="text-sm text-destructive">{(errors.transferFrom as any).message}</p>}
                    </div>
                    {transferFrom === 'cash' && (
                        <div className="space-y-2 animate-fade-in">
                            <Label>To Bank Account</Label>
                            <Controller
                                control={control}
                                name="transferToBankId"
                                render={({ field }) => (
                                    <ResponsiveSelect 
                                        onValueChange={field.onChange} 
                                        value={field.value}
                                        title="Select destination bank"
                                        placeholder="Select a bank account"
                                        items={bankAccountItems}
                                    />
                                )}
                            />
                            {errors.transferToBankId && <p className="text-sm text-destructive">{(errors.transferToBankId as any).message}</p>}
                        </div>
                    )}
                    {transferFrom === 'bank' && (
                        <div className="space-y-2 animate-fade-in">
                            <Label>From Bank Account</Label>
                            <Controller
                                control={control}
                                name="transferFromBankId"
                                render={({ field }) => (
                                    <ResponsiveSelect 
                                        onValueChange={field.onChange} 
                                        value={field.value}
                                        title="Select source bank"
                                        placeholder="Select a bank account"
                                        items={bankAccountItems}
                                    />
                                )}
                            />
                            {errors.transferFromBankId && <p className="text-sm text-destructive">{(errors.transferFromBankId as any).message}</p>}
                        </div>
                    )}
                  </div>
              )}

              {transactionType === 'ap_ar' && (
                  <div className="m-0 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            {dateField}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount-ledger">Amount</Label>
                            <Input id="amount-ledger" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                            {errors.amount && <p className="text-sm text-destructive">{(errors.amount as any).message}</p>}
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
                        {errors.ledgerType && <p className="text-sm text-destructive">{(errors.ledgerType as any).message}</p>}
                    </div>

                    {ledgerType && (
                        <div className="space-y-2 animate-fade-in">
                            <Label>{currentLedgerContactType}</Label>
                            <Controller
                                control={control}
                                name="contact_id"
                                render={({ field }) => (
                                    <ResponsiveSelect
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        title={`Select a ${currentLedgerContactType}`}
                                        placeholder={`Select a ${currentLedgerContactType}`}
                                        items={currentLedgerContactItems}
                                    />
                                )}
                            />
                            {errors.contact_id && <p className="text-sm text-destructive">{(errors.contact_id as any).message}</p>}
                        
                            {contact_id === 'new' && (
                                <div className="flex items-end gap-2 pt-2 animate-fade-in">
                                    <div className="flex-grow space-y-1">
                                        <Label htmlFor="newContact">New {currentLedgerContactType} Name</Label>
                                        <Input {...register('newContact')} placeholder={`Enter new ${currentLedgerContactType.toLowerCase()} name`}/>
                                    </div>
                                </div>
                            )}
                            {errors.newContact && <p className="text-sm text-destructive">{(errors.newContact as any).message}</p>}
                        </div>
                    )}
                        <div className="space-y-2">
                        <Label htmlFor="description-ap">Description</Label>
                        <Input id="description-ap" {...register('description')} placeholder="e.g., Raw materials from X vendor" />
                        {errors.description && <p className="text-sm text-destructive">{(errors.description as any).message}</p>}
                    </div>
                  </div>
              )}
          </div>
          <div className="flex justify-end pt-6">
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Record Transaction
              </Button>
          </div>
      </form>
    </>
  );
}
