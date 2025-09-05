
"use client";

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useMemo, useEffect } from 'react';
import { useAppActions } from '@/app/context/app-actions';
import { useAppContext } from '@/app/context/app-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveSelect } from '@/components/ui/responsive-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';

const apArSchema = z.object({
    date: z.date({ required_error: "Date is required." }),
    amount: z.coerce.number().positive("Amount must be a positive number."),
    ledgerType: z.enum(['payable', 'receivable'], { required_error: "Please select payable or receivable." }),
    contact_id: z.string({ required_error: "A contact is required." }),
    newContact: z.string().optional(),
    description: z.string().min(1, "Description is required."),
}).superRefine((data, ctx) => {
    if (data.contact_id === 'new' && (!data.newContact || data.newContact.trim().length === 0)) {
        ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
    }
});

type FormData = z.infer<typeof apArSchema>;

interface ApArFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function ApArForm({ setDialogOpen }: ApArFormProps) {
  const { addLedgerTransaction, addVendor, addClient } = useAppActions();
  const { vendors, clients } = useAppContext();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(apArSchema),
    defaultValues: {
      date: new Date(),
    }
  });

  const ledgerType = watch('ledgerType');
  const contact_id = watch('contact_id');

  const vendorContactItems = useMemo(() => [
    ...(vendors || []).map(c => ({ value: c.id, label: c.name })),
    { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4" />Add New</span> }
  ], [vendors]);

  const clientContactItems = useMemo(() => [
    ...(clients || []).map(c => ({ value: c.id, label: c.name })),
    { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4" />Add New</span> }
  ], [clients]);

  const currentLedgerContactItems = ledgerType === 'payable' ? vendorContactItems : clientContactItems;
  const currentLedgerContactType = ledgerType === 'payable' ? 'Vendor' : 'Client';

  const onSubmit = async (data: FormData) => {
    const transactionDate = format(data.date, 'yyyy-MM-dd');
    try {
        let ledgerContactId: string | undefined;
        let ledgerContactName: string | undefined;
        const contactType = data.ledgerType === 'payable' ? 'vendor' : 'client';
        const contactList = data.ledgerType === 'payable' ? vendors : clients;

        if (data.contact_id === 'new') {
            const newContactFn = data.ledgerType === 'payable' ? addVendor : addClient;
            const newContact = await newContactFn(data.newContact!);
            if (!newContact) throw new Error(`Failed to create new ${contactType}.`);
            ledgerContactId = newContact.id;
            ledgerContactName = newContact.name;
        } else {
            ledgerContactId = data.contact_id;
            ledgerContactName = (contactList || []).find(c => c.id === ledgerContactId)?.name;
        }

        if (!ledgerContactId || !ledgerContactName) {
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

        toast.success("A/R or A/P Entry Added");
        setDialogOpen(false);
    } catch (error: any) {
        toast.error("Operation Failed", { description: error.message });
    }
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>New A/R or A/P Entry</CardTitle>
        <CardDescription>Record a new payable or receivable item that is not tied to a stock transaction.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "dd-MM-yyyy") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={(date) => { if (date) field.onChange(date); setIsDatePickerOpen(false); }} initialFocus />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount-ledger">Amount</Label>
              <Input id="amount-ledger" type="number" step="0.01" {...register('amount')} placeholder="0.00" />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Controller
              control={control}
              name="ledgerType"
              render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row pt-2 gap-4">
                  <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="payable" />Payable (Expense on Credit)</Label>
                  <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="receivable" />Receivable (Sale on Credit)</Label>
                </RadioGroup>
              )}
            />
            {errors.ledgerType && <p className="text-sm text-destructive">{errors.ledgerType.message}</p>}
          </div>
          {ledgerType && (
            <div className="space-y-2 animate-fade-in">
              <Label>{currentLedgerContactType}</Label>
              <Controller
                control={control}
                name="contact_id"
                render={({ field }) => (
                  <ResponsiveSelect onValueChange={field.onChange} value={field.value} title={`Select a ${currentLedgerContactType}`} placeholder={`Select a ${currentLedgerContactType}`} items={currentLedgerContactItems} />
                )}
              />
              {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
              {contact_id === 'new' && (
                <div className="flex items-end gap-2 pt-2 animate-fade-in">
                  <div className="flex-grow space-y-1">
                    <Label htmlFor="newContact">New {currentLedgerContactType} Name</Label>
                    <Input {...register('newContact')} placeholder={`Enter new ${currentLedgerContactType.toLowerCase()} name`} />
                  </div>
                </div>
              )}
              {errors.newContact && <p className="text-sm text-destructive">{errors.newContact.message}</p>}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="description-ap">Description</Label>
            <Input id="description-ap" {...register('description')} placeholder="e.g., Raw materials from X vendor" />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Entry
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
