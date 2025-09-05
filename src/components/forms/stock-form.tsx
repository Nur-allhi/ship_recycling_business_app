"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppActions } from '@/app/context/app-actions';
import { useAppContext } from '@/app/context/app-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveSelect } from '@/components/ui/responsive-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CalendarIcon, Plus, Loader2, Link } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Separator } from '../ui/separator';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { useScrollOnFocus } from '@/hooks/use-scroll-on-focus';

const stockSchema = z.object({
    date: z.date({ required_error: "Date is required." }),
    stockType: z.enum(['purchase', 'sale'], { required_error: "Please select purchase or sale."}),
    stockItemName: z.string({ required_error: "Item name is required." }),
    weight: z.coerce.number().positive(),
    pricePerKg: z.coerce.number().nonnegative(),
    paymentMethod: z.enum(['cash', 'bank', 'credit'], { required_error: "Payment method is required." }),
    description: z.string().optional(),
    bank_id: z.string().optional(),
    contact_id: z.string().optional(),
    newContact: z.string().optional(),
    expected_amount: z.coerce.number().positive(),
    actual_amount: z.coerce.number().nonnegative(),
    difference_reason: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.paymentMethod === 'bank' && !data.bank_id) {
        ctx.addIssue({ code: 'custom', message: 'Bank account is required.', path: ['bank_id'] });
    }
    if (data.paymentMethod === 'credit' && !data.contact_id) {
        ctx.addIssue({ code: 'custom', message: 'A contact is required for credit transactions.', path: ['contact_id'] });
    }
    if (data.contact_id === 'new' && (!data.newContact || data.newContact.trim().length === 0)) {
        ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
    }
});

type FormData = z.infer<typeof stockSchema>;

interface StockFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function StockForm({ setDialogOpen }: StockFormProps) {
  const { addStockTransaction, addVendor, addClient } = useAppActions();
  const { stockItems, vendors, clients, banks, currency } = useAppContext();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isNewStockItem, setIsNewStockItem] = useState(false);
  const [showStockContact, setShowStockContact] = useState(false);
  const { registerForFocus, containerRef } = useScrollOnFocus();

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(stockSchema),
    defaultValues: { date: new Date() }
  });

  const stockType = watch('stockType');
  const paymentMethod = watch('paymentMethod');
  const contact_id = watch('contact_id');
  const weight = watch('weight');
  const pricePerKg = watch('pricePerKg');
  const expected_amount = watch('expected_amount');
  const actual_amount = watch('actual_amount');
  
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // Force scroll to top when the form mounts
      container.scrollTop = 0;
    }
  }, [containerRef]);

  useEffect(() => {
    if (weight && pricePerKg) {
      const calculatedAmount = weight * pricePerKg;
      setValue('expected_amount', calculatedAmount);
      if (watch('actual_amount') === undefined || watch('actual_amount') === calculatedAmount) {
        setValue('actual_amount', calculatedAmount);
      }
    }
  }, [weight, pricePerKg, setValue, watch]);
  
  useEffect(() => {
    setValue('contact_id', undefined);
    setValue('newContact', '');
  }, [stockType, setValue]);

  useEffect(() => {
    if (paymentMethod === 'credit') {
        setShowStockContact(true);
    }
  }, [paymentMethod]);
  
  const difference = useMemo(() => {
    if (paymentMethod === 'credit') return 0;
    const expected = parseFloat(expected_amount || '0');
    const actual = parseFloat(actual_amount || '0');
    if (isNaN(expected) || isNaN(actual)) return 0;
    return actual - expected;
  }, [expected_amount, actual_amount, paymentMethod]);


  const onSubmit = async (data: FormData) => {
    const transactionDate = format(data.date, 'yyyy-MM-dd');
    try {
        let stockContactId: string | undefined;
        let stockContactName: string | undefined;

        if (data.contact_id === 'new') {
            const newContactFn = data.stockType === 'purchase' ? addVendor : addClient;
            const newContact = await newContactFn(data.newContact!);
            if (!newContact) throw new Error(`Failed to create new ${data.stockType === 'purchase' ? 'vendor' : 'client'}.`);
            stockContactId = newContact.id;
            stockContactName = newContact.name;
        } else if (data.contact_id) {
            stockContactId = data.contact_id;
            const contactList = data.stockType === 'purchase' ? vendors : clients;
            stockContactName = (contactList || []).find(c => c.id === stockContactId)?.name;
        }

        await addStockTransaction({
            type: data.stockType,
            stockItemName: data.stockItemName,
            weight: data.weight,
            pricePerKg: data.pricePerKg,
            paymentMethod: data.paymentMethod,
            description: data.description,
            date: transactionDate,
            expected_amount: data.expected_amount,
            actual_amount: paymentMethod === 'credit' ? data.expected_amount : data.actual_amount,
            difference: difference,
            difference_reason: data.difference_reason,
            contact_id: stockContactId,
            contact_name: stockContactName,
        }, data.bank_id);
        
        toast.success("Stock Transaction Added");
        setDialogOpen(false);
    } catch (error: any) {
        toast.error("Operation Failed", { description: error.message });
    }
  };

  const stockContactType = stockType === 'purchase' ? 'Vendor' : 'Client';
  const stockItemsForSale = useMemo(() => (stockItems || []).filter(i => i.weight > 0).map(item => ({ value: item.name, label: item.name })), [stockItems]);
  const stockItemsForPurchase = useMemo(() => (stockItems || []).map(item => ({ value: item.name, label: item.name })), [stockItems]);
  const bankAccountItems = useMemo(() => (banks || []).map(b => ({ value: b.id, label: b.name })), [banks]);
  const vendorContactItems = useMemo(() => [...(vendors || []).map(c => ({ value: c.id, label: c.name })), { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>}], [vendors]);
  const clientContactItems = useMemo(() => [...(clients || []).map(c => ({ value: c.id, label: c.name })), { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>}], [clients]);
  const currentStockContactItems = stockType === 'purchase' ? vendorContactItems : clientContactItems;

  return (
    <Card className="border-0 shadow-none">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div ref={containerRef} className="overflow-y-auto px-4 sm:px-6 pb-8">
            <CardContent className="space-y-4 pt-4 px-0">
                <div className="space-y-2">
                    <Label>Date</Label>
                    <Controller name="date" control={control} render={({ field }) => (
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd-MM-yyyy") : <span>Pick a date</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(d) => { if (d) field.onChange(d); setIsDatePickerOpen(false); }} initialFocus /></PopoverContent>
                    </Popover>
                    )} />
                    {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Transaction Type</Label>
                    <Controller name="stockType" control={control} render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                        <Label htmlFor="purchase" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="purchase" id="purchase" />Purchase</Label>
                        <Label htmlFor="sale" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="sale" id="sale" />Sale</Label>
                    </RadioGroup>
                    )} />
                    {errors.stockType && <p className="text-sm text-destructive">{errors.stockType.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Item Name</Label>
                    {stockType === 'purchase' ? (
                    <div className="flex items-center gap-2">
                        {isNewStockItem ? <Input {...register('stockItemName')} placeholder="e.g. Iron Rod" {...registerForFocus('stockItemName')}/> : <Controller name="stockItemName" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select an item" placeholder="Select existing item" className="flex-1" items={stockItemsForPurchase} />} />}
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsNewStockItem(prev => !prev)}>{isNewStockItem ? 'Select Existing' : 'Add New'}</Button>
                    </div>
                    ) : <Controller name="stockItemName" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select an item" placeholder="Select item to sell" items={stockItemsForSale} />} />}
                    {errors.stockItemName && <p className="text-sm text-destructive">{errors.stockItemName.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Weight (kg)</Label><Input type="number" step="0.01" {...register('weight')} placeholder="0.00" {...registerForFocus('weight')}/>{errors.weight && <p className="text-sm text-destructive">{errors.weight.message}</p>}</div>
                    <div className="space-y-2"><Label>Price per kg</Label><Input type="number" step="0.01" {...register('pricePerKg')} placeholder="0.00" {...registerForFocus('pricePerKg')}/>{errors.pricePerKg && <p className="text-sm text-destructive">{errors.pricePerKg.message}</p>}</div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Controller name="paymentMethod" control={control} render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2 gap-4">
                        <Label htmlFor="cash-payment" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" id="cash-payment" /><span>Cash</span></Label>
                        <Label htmlFor="bank-payment" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" id="bank-payment" /><span>Bank</span></Label>
                        <Label htmlFor="credit-payment" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="credit" id="credit-payment" /><span>Credit</span></Label>
                    </RadioGroup>
                    )} />
                    {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                </div>

                {stockType && (showStockContact || paymentMethod === 'credit') ? (
                    <div className="space-y-2 animate-fade-in">
                    <Label>{stockContactType}</Label>
                    <Controller name="contact_id" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title={`Select a ${stockContactType}`} placeholder={`Select a ${stockContactType}`} items={currentStockContactItems} />} />
                    {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
                    {contact_id === 'new' && <div className="flex items-end gap-2 pt-2 animate-fade-in"><div className="flex-grow space-y-1"><Label htmlFor="newContact">New {stockContactType} Name</Label><Input {...register('newContact')} placeholder={`Enter new ${stockContactType.toLowerCase()} name`} {...registerForFocus('newContact')}/></div></div>}
                    {errors.newContact && <p className="text-sm text-destructive">{errors.newContact.message}</p>}
                    </div>
                ) : stockType && paymentMethod !== 'credit' && (
                    <div className="pt-2"><Button type="button" variant="link" size="sm" className="p-0 h-auto" onClick={() => setShowStockContact(true)}><Link className="mr-2 h-4 w-4" />Link to a {stockContactType} (Optional)</Button></div>
                )}

                {paymentMethod === 'bank' && <div className="space-y-2 animate-fade-in"><Label>Bank Account</Label><Controller name="bank_id" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select bank" placeholder="Select bank" items={bankAccountItems} />} />{errors.bank_id && <p className="text-sm text-destructive">{errors.bank_id.message}</p>}</div>}
                
                {paymentMethod !== 'credit' && (
                    <div className="p-4 border rounded-md bg-muted/30 space-y-4 animate-fade-in">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between"><Label htmlFor="actual_amount">Amount Paid/Received</Label><span className="text-sm text-muted-foreground">Expected: {currency} {((weight || 0) * (pricePerKg || 0)).toFixed(2)}</span></div>
                            <Input id="actual_amount" type="number" step="0.01" {...register('actual_amount')} placeholder="e.g., Actual cash paid" {...registerForFocus('actual_amount')}/>
                            {errors.actual_amount && <p className="text-sm text-destructive">{errors.actual_amount.message}</p>}
                        </div>
                        {difference !== 0 && (
                            <div className="space-y-2 animate-fade-in">
                                <div className="flex justify-between items-center"><Label>Difference</Label><span className={cn("font-bold", difference > 0 ? "text-accent" : "text-destructive")}>{new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'symbol' }).format(difference)}</span></div>
                                <div className="space-y-2"><Label htmlFor="difference_reason">Reason for Difference</Label><Input id="difference_reason" {...register('difference_reason')} placeholder="e.g., Discount, Rounding" {...registerForFocus('difference_reason')}/></div>
                            </div>
                        )}
                    </div>
                )}

                {paymentMethod === 'credit' && stockType && <div className="space-y-2 animate-fade-in pt-2"><Alert variant="default" className="mt-4 bg-blue-50 border-blue-200 text-blue-800"><AlertTitle>On Credit</AlertTitle><AlertDescription>This will create a new item in your Accounts {stockType === 'purchase' ? 'Payable' : 'Receivable'} ledger.</AlertDescription></Alert></div>}
                
                <div className="space-y-2"><Label htmlFor="description-stock">Description (Optional)</Label><Input id="description-stock" {...register('description')} placeholder="e.g., invoice #, delivery details" {...registerForFocus('description')}/>{errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}</div>
            
            </CardContent>
        </div>
        <CardFooter className="flex justify-end p-4 sm:p-6 border-t">
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Transaction</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
