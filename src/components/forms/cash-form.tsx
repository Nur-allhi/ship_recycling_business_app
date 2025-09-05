
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
import { toast } from 'sonner';
import { CalendarIcon, Plus, Settings2, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { CommandSeparator } from '../ui/command';

const cashSchema = z.object({
    date: z.date({ required_error: "Date is required." }),
    amount: z.coerce.number().positive("Amount must be a positive number."),
    category: z.string({ required_error: "Category is required." }),
    description: z.string().min(1, "Description is required."),
    contact_id: z.string().optional(),
    expected_amount: z.coerce.number().optional(),
    actual_amount: z.coerce.number().optional(),
    difference_reason: z.string().optional(),
    payLater: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.payLater && !data.contact_id) {
        ctx.addIssue({ code: 'custom', message: 'A vendor is required for pay later transactions.', path: ['contact_id'] });
    }
});

type FormData = z.infer<typeof cashSchema>;

interface CashFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function CashForm({ setDialogOpen }: CashFormProps) {
  const { addCashTransaction, addLedgerTransaction } = useAppActions();
  const { cashCategories, cashTransactions, vendors, clients, currency } = useAppContext();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(cashSchema),
    defaultValues: { date: new Date(), payLater: false }
  });

  const watchedAmount = useWatch({ control, name: 'amount' });
  const watchedExpectedAmount = useWatch({ control, name: 'expected_amount' });
  const watchedActualAmount = useWatch({ control, name: 'actual_amount' });
  const categoryName = useWatch({ control, name: 'category' });
  const payLater = watch('payLater');
  
  const categoryInfo = useMemo(() => (cashCategories || []).find(c => c.name === categoryName), [cashCategories, categoryName]);
  const isExpense = categoryInfo?.direction === 'debit';
  const isSettlement = categoryName === 'A/R Settlement' || categoryName === 'A/P Settlement';
  const settlementContactType = categoryName === 'A/P Settlement' ? 'Vendor' : 'Client';
  const settlementContacts = settlementContactType === 'Vendor' ? vendors : clients;

  useEffect(() => {
    if (!showAdvancedFields && typeof watchedAmount === 'number') {
        setValue('expected_amount', watchedAmount);
        setValue('actual_amount', watchedAmount);
    }
  }, [watchedAmount, showAdvancedFields, setValue]);
  
  useEffect(() => {
    if (!isSettlement) setValue('contact_id', undefined);
  }, [isSettlement, setValue]);

  const difference = useMemo(() => {
    const expected = watchedExpectedAmount || 0;
    const actual = watchedActualAmount || 0;
    if (isNaN(expected) || isNaN(actual) || !showAdvancedFields) return 0;
    return actual - expected;
  }, [watchedExpectedAmount, watchedActualAmount, showAdvancedFields]);

  const onSubmit = async (data: FormData) => {
    const transactionDate = format(data.date, 'yyyy-MM-dd');
    try {
        if (data.payLater && isExpense) {
            const contact = vendors.find(v => v.id === data.contact_id);
            if (!contact) throw new Error("Vendor not found for pay later transaction.");
            await addLedgerTransaction({ type: 'payable', description: data.description, amount: data.amount, date: transactionDate, contact_id: data.contact_id!, contact_name: contact.name });
        } else {
            if (!categoryInfo) throw new Error("Category information not found.");
            await addCashTransaction({
                type: categoryInfo.direction === 'credit' ? 'income' : 'expense',
                expected_amount: showAdvancedFields ? data.expected_amount! : data.amount,
                actual_amount: showAdvancedFields ? data.actual_amount! : data.amount,
                difference: difference,
                difference_reason: data.difference_reason,
                description: data.description,
                category: data.category,
                date: transactionDate,
                contact_id: data.contact_id,
            });
        }
        toast.success("Cash Transaction Added");
        setDialogOpen(false);
    } catch (error: any) {
        toast.error("Operation Failed", { description: error.message });
    }
  };

  const categoryItems = useMemo(() => {
    const filteredCategories = (cashCategories || []).filter(c => c.name !== 'Stock Purchase' && c.name !== 'Stock Sale');
    if (!cashTransactions || cashTransactions.length === 0) {
        return filteredCategories.map(c => ({ value: c.name, label: c.name }));
    }
    
    const categoryCounts = cashTransactions.reduce((acc, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedCategories = filteredCategories.sort((a, b) => (categoryCounts[b.name] || 0) - (categoryCounts[a.name] || 0));
    
    return sortedCategories.map(c => ({ value: c.name, label: c.name }));
}, [cashCategories, cashTransactions]);

  const vendorContactItems = useMemo(() => (vendors || []).map(c => ({ value: c.id, label: c.name })), [vendors]);
  const clientContactItems = useMemo(() => (clients || []).map(c => ({ value: c.id, label: c.name })), [clients]);
  
  return (
    <Card className="border-0 shadow-none overflow-y-auto pb-8">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-4 px-4 sm:px-6">
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
            <Label>Category</Label>
            <Controller name="category" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select category" placeholder="Select category" items={categoryItems} showSearch={false} />} />
            {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
          </div>

          {isSettlement && (
            <div className="space-y-2 animate-fade-in">
              <Label>{settlementContactType}</Label>
              <Controller name="contact_id" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title={`Select a ${settlementContactType}`} placeholder={`Select a ${settlementContactType}`} items={settlementContactType === 'Vendor' ? vendorContactItems : clientContactItems} />} />
              {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
            </div>
          )}

          {!isSettlement && (
            <>
              <div className="flex items-center space-x-2 pt-2">
                <Controller name="payLater" control={control} render={({ field }) => <Checkbox id="payLater" checked={field.value} onCheckedChange={field.onChange} disabled={!isExpense} />} />
                <label htmlFor="payLater" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Pay Later (Create Payable)</label>
              </div>
              {payLater && isExpense && (
                <div className="space-y-2 animate-fade-in">
                  <Label>Vendor</Label>
                  <Controller name="contact_id" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select a Vendor" placeholder="Select a Vendor" items={vendorContactItems} />} />
                  {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="description-cash">Description</Label>
            <Input id="description-cash" {...register('description')} placeholder="e.g., Office supplies"/>
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              {!showAdvancedFields && <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setShowAdvancedFields(true)}><Settings2 className="mr-1 h-3 w-3" />Adjust</Button>}
            </div>
            <Input id="amount" type="number" step="0.01" {...register('amount')} placeholder="e.g., 1000.00" disabled={showAdvancedFields}/>
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>

          {showAdvancedFields && (
            <div className="p-4 border rounded-md bg-muted/30 space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="expected_amount">Transaction Value</Label><Input id="expected_amount" type="number" step="0.01" {...register('expected_amount')} placeholder="e.g., Invoice total"/>{errors.expected_amount && <p className="text-sm text-destructive">{errors.expected_amount.message}</p>}</div>
                <div className="space-y-2"><Label htmlFor="actual_amount">Amount Paid/Received</Label><Input id="actual_amount" type="number" step="0.01" {...register('actual_amount')} placeholder="e.g., Actual cash paid"/>{errors.actual_amount && <p className="text-sm text-destructive">{errors.actual_amount.message}</p>}</div>
              </div>
              {difference !== 0 && (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex justify-between items-center"><Label>Difference</Label><span className={cn("font-bold", difference > 0 ? "text-accent" : "text-destructive")}>{new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'symbol' }).format(difference)}</span></div>
                  <div className="space-y-2"><Label htmlFor="difference_reason">Reason for Difference</Label><Input id="difference_reason" {...register('difference_reason')} placeholder="e.g., Discount, Rounding"/></div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end p-4 sm:p-6">
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Transaction</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
