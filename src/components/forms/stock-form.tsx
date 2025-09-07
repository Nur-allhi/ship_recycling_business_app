
"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { CalendarIcon, Plus, Loader2, Link, ArrowLeft, ArrowRight, Wallet, Landmark, CreditCard } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Separator } from '../ui/separator';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { AnimatePresence, motion } from 'framer-motion';
import { Progress } from '../ui/progress';

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
  const { addStockTransaction, addContact } = useAppActions();
  const { stockItems, contacts, banks, currency } = useAppContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isNewStockItem, setIsNewStockItem] = useState(false);
  const [showStockContact, setShowStockContact] = useState(false);

  const { register, handleSubmit, control, setValue, watch, trigger, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(stockSchema),
    defaultValues: { date: new Date() }
  });

  const formData = watch();
  const { stockType, paymentMethod, contact_id, weight, pricePerKg, expected_amount, actual_amount } = formData;
  
  useEffect(() => {
    if (weight && pricePerKg) {
      const calculatedAmount = weight * pricePerKg;
      setValue('expected_amount', calculatedAmount);
      if (formData.actual_amount === undefined || formData.actual_amount === calculatedAmount) {
        setValue('actual_amount', calculatedAmount);
      }
    }
  }, [weight, pricePerKg, setValue, formData.actual_amount]);
  
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
    const expected = expected_amount || 0;
    const actual = actual_amount || 0;
    if (isNaN(expected) || isNaN(actual)) return 0;
    return actual - expected;
  }, [expected_amount, actual_amount, paymentMethod]);


  const onSubmit = async (data: FormData) => {
    const transactionDate = format(data.date, 'yyyy-MM-dd');
    try {
        let finalContactId: string | undefined;
        let finalContactName: string | undefined;

        if (data.contact_id === 'new' && data.newContact) {
            const contactType = data.stockType === 'purchase' ? 'vendor' : 'client';
            const newContact = await addContact(data.newContact, contactType);
            if (!newContact) throw new Error("Failed to create new contact.");
            finalContactId = newContact.id;
            finalContactName = newContact.name;
        } else if (data.contact_id) {
            finalContactId = data.contact_id;
            finalContactName = contacts.find(c => c.id === data.contact_id)?.name;
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
            contact_id: finalContactId,
            contact_name: finalContactName,
            bank_id: data.bank_id,
        });
        
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
  
  const vendorContactItems = useMemo(() => [...(contacts || []).filter(c => c.type === 'vendor' || c.type === 'both').map(c => ({ value: c.id, label: c.name })), { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>}], [contacts]);
  const clientContactItems = useMemo(() => [...(contacts || []).filter(c => c.type === 'client' || c.type === 'both').map(c => ({ value: c.id, label: c.name })), { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4"/>Add New</span>}], [contacts]);
  const currentStockContactItems = stockType === 'purchase' ? vendorContactItems : clientContactItems;

  const steps = [
      { name: 'Details', fields: ['date', 'stockType', 'stockItemName', 'weight', 'pricePerKg'] },
      { name: 'Payment', fields: ['paymentMethod', 'bank_id', 'contact_id', 'newContact', 'actual_amount', 'difference_reason'] },
      { name: 'Review', fields: [] }
  ];

  const nextStep = async () => {
      const fields = steps[currentStep].fields;
      const output = await trigger(fields as any, { shouldFocus: true });
      if (!output) return;
      
      if (currentStep < steps.length - 1) {
          setCurrentStep(step => step + 1);
      }
  };

  const prevStep = () => {
      if (currentStep > 0) {
          setCurrentStep(step => step - 1);
      }
  };

  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
        <div className="p-4 sm:p-6 shrink-0">
             <Progress value={(currentStep / (steps.length - 1)) * 100} className="w-full h-2" />
        </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex-grow flex flex-col overflow-hidden">
        <div className="flex-grow overflow-y-auto px-4 sm:px-6 pb-16">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -30, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {currentStep === 0 && (
                        <div className="space-y-6">
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
                                    {isNewStockItem ? <Input {...register('stockItemName')} placeholder="e.g. Iron Rod"/> : <Controller name="stockItemName" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select an item" placeholder="Select existing item" className="flex-1" items={stockItemsForPurchase} />} />}
                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsNewStockItem(prev => !prev)}>{isNewStockItem ? 'Select Existing' : 'Add New'}</Button>
                                </div>
                                ) : <Controller name="stockItemName" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select an item" placeholder="Select item to sell" items={stockItemsForSale} />} />}
                                {errors.stockItemName && <p className="text-sm text-destructive">{errors.stockItemName.message}</p>}
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Weight (kg)</Label><Input type="number" step="0.01" {...register('weight')} placeholder="0.00"/>{errors.weight && <p className="text-sm text-destructive">{errors.weight.message}</p>}</div>
                                <div className="space-y-2"><Label>Price per kg</Label><Input type="number" step="0.01" {...register('pricePerKg')} placeholder="0.00"/>{errors.pricePerKg && <p className="text-sm text-destructive">{errors.pricePerKg.message}</p>}</div>
                            </div>
                        </div>
                    )}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label>Payment Method</Label>
                                <Controller name="paymentMethod" control={control} render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2 pt-2">
                                    <Label htmlFor="cash-payment" className="flex flex-col items-center gap-2 cursor-pointer border rounded-md p-2 hover:bg-accent has-[:checked]:bg-accent has-[:checked]:border-primary"><RadioGroupItem value="cash" id="cash-payment" className="sr-only" /><Wallet className="h-6 w-6 mb-1"/>Cash</Label>
                                    <Label htmlFor="bank-payment" className="flex flex-col items-center gap-2 cursor-pointer border rounded-md p-2 hover:bg-accent has-[:checked]:bg-accent has-[:checked]:border-primary"><RadioGroupItem value="bank" id="bank-payment" className="sr-only" /><Landmark className="h-6 w-6 mb-1"/>Bank</Label>
                                    <Label htmlFor="credit-payment" className="flex flex-col items-center gap-2 cursor-pointer border rounded-md p-2 hover:bg-accent has-[:checked]:bg-accent has-[:checked]:border-primary"><RadioGroupItem value="credit" id="credit-payment" className="sr-only" /><CreditCard className="h-6 w-6 mb-1"/>Credit</Label>
                                </RadioGroup>
                                )} />
                                {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                            </div>
                            
                            {paymentMethod === 'bank' && <div className="space-y-2 animate-fade-in"><Label>Bank Account</Label><Controller name="bank_id" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select bank" placeholder="Select bank" items={bankAccountItems} />} />{errors.bank_id && <p className="text-sm text-destructive">{errors.bank_id.message}</p>}</div>}

                            {stockType && (paymentMethod === 'credit' || showStockContact) ? (
                                <div className="space-y-2 animate-fade-in">
                                <Label>{stockContactType}</Label>
                                <Controller name="contact_id" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title={`Select a ${stockContactType}`} placeholder={`Select a ${stockContactType}`} items={currentStockContactItems} />} />
                                {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
                                {contact_id === 'new' && <div className="flex items-end gap-2 pt-2 animate-fade-in"><div className="flex-grow space-y-1"><Label htmlFor="newContact">New {stockContactType} Name</Label><Input {...register('newContact')} placeholder={`Enter new ${stockContactType.toLowerCase()} name`}/></div></div>}
                                {errors.newContact && <p className="text-sm text-destructive">{errors.newContact.message}</p>}
                                </div>
                            ) : stockType && paymentMethod !== 'credit' && (
                                <div className="pt-2"><Button type="button" variant="link" size="sm" className="p-0 h-auto" onClick={() => setShowStockContact(true)}><Link className="mr-2 h-4 w-4" />Link to a {stockContactType} (Optional)</Button></div>
                            )}

                             {paymentMethod !== 'credit' && (
                                <div className="p-4 border rounded-md bg-muted/30 space-y-4 animate-fade-in">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between"><Label htmlFor="actual_amount">Amount Paid/Received</Label><span className="text-sm text-muted-foreground">Expected: {formatCurrency(expected_amount || 0)}</span></div>
                                        <Input id="actual_amount" type="number" step="0.01" {...register('actual_amount')} placeholder="e.g., Actual cash paid"/>
                                        {errors.actual_amount && <p className="text-sm text-destructive">{errors.actual_amount.message}</p>}
                                    </div>
                                    {difference !== 0 && (
                                        <div className="space-y-2 animate-fade-in">
                                            <div className="flex justify-between items-center"><Label>Difference</Label><span className={cn("font-bold", difference > 0 ? "text-accent" : "text-destructive")}>{formatCurrency(difference)}</span></div>
                                            <div className="space-y-2"><Label htmlFor="difference_reason">Reason for Difference</Label><Input id="difference_reason" {...register('difference_reason')} placeholder="e.g., Discount, Rounding"/></div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {paymentMethod === 'credit' && stockType && <div className="space-y-2 animate-fade-in pt-2"><Alert variant="default" className="mt-4 bg-blue-50 border-blue-200 text-blue-800"><AlertTitle>On Credit</AlertTitle><AlertDescription>This will create a new item in your Accounts {stockType === 'purchase' ? 'Payable' : 'Receivable'} ledger.</AlertDescription></Alert></div>}
                        </div>
                    )}
                    {currentStep === 2 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-center">Review Transaction</h3>
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between"><span>Date:</span><span className="font-medium">{format(formData.date, 'dd MMM, yyyy')}</span></div>
                                    <div className="flex justify-between"><span>Type:</span><span className="font-medium capitalize">{formData.stockType}</span></div>
                                    <div className="flex justify-between"><span>Item:</span><span className="font-medium">{formData.stockItemName}</span></div>
                                    <div className="flex justify-between"><span>Weight:</span><span className="font-medium">{formData.weight} kg</span></div>
                                    <div className="flex justify-between"><span>Price/kg:</span><span className="font-medium">{formatCurrency(formData.pricePerKg)}</span></div>
                                    <Separator />
                                    <div className="flex justify-between"><span>Total Value:</span><span className="font-bold">{formatCurrency(formData.expected_amount)}</span></div>
                                    <Separator />
                                    <div className="flex justify-between"><span>Payment:</span><span className="font-medium capitalize">{formData.paymentMethod}</span></div>
                                    {formData.paymentMethod !== 'credit' && <div className="flex justify-between"><span>Amount Paid:</span><span className="font-medium">{formatCurrency(formData.actual_amount)}</span></div>}
                                    {difference !== 0 && <div className="flex justify-between"><span>Difference:</span><span className="font-medium">{formatCurrency(difference)}</span></div>}
                                </CardContent>
                            </Card>
                            <div className="space-y-2">
                                <Label htmlFor="description-stock">Description (Optional)</Label>
                                <Input id="description-stock" {...register('description')} placeholder="e.g., invoice #, delivery details"/>
                                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="shrink-0 flex justify-between p-4 sm:p-6 border-t bg-background">
            <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            {currentStep === steps.length - 1 ? (
                 <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Transaction
                </Button>
            ) : (
                <Button type="button" onClick={nextStep}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            )}
        </div>
      </form>
    </div>
  );
}
