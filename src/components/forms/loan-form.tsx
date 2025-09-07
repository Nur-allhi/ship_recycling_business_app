
"use client";

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMemo, useState } from 'react';
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
import { format, formatISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Separator } from '../ui/separator';

const loanSchema = z.object({
    type: z.enum(['payable', 'receivable'], { required_error: "Please select loan type." }),
    contact_id: z.string({ required_error: "A contact is required." }),
    newContact: z.string().optional(),
    principal_amount: z.coerce.number().positive("Principal must be a positive number."),
    interest_rate: z.coerce.number().nonnegative("Interest rate cannot be negative.").optional().default(0),
    issue_date: z.date({ required_error: "Issue date is required." }),
    due_date: z.date().optional(),
    disbursement_method: z.enum(['cash', 'bank'], { required_error: "Disbursement method is required." }),
    bank_id: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.contact_id === 'new' && (!data.newContact || data.newContact.trim().length === 0)) {
        ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
    }
    if (data.disbursement_method === 'bank' && !data.bank_id) {
        ctx.addIssue({ code: 'custom', message: 'A bank account is required.', path: ['bank_id'] });
    }
});

type FormData = z.infer<typeof loanSchema>;

interface LoanFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function LoanForm({ setDialogOpen }: LoanFormProps) {
  const { addLoan } = useAppActions();
  const { contacts, banks } = useAppContext();
  const [issueDatePickerOpen, setIssueDatePickerOpen] = useState(false);
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      issue_date: new Date(),
    }
  });

  const loanType = watch('type');
  const contact_id = watch('contact_id');
  const disbursementMethod = watch('disbursement_method');

  const contactItems = useMemo(() => {
    if (!loanType) return [];
    const contactTypeFilter = loanType === 'payable' ? 'vendor' : 'client';
    return [
      ...contacts.filter(c => c.type === contactTypeFilter || c.type === 'both').map(c => ({ value: c.id, label: c.name })),
      { value: 'new', label: <span className="flex items-center gap-2"><Plus className="h-4 w-4" />Add New {contactTypeFilter}</span> }
    ];
  }, [contacts, loanType]);

  const bankAccountItems = useMemo(() => banks.map(b => ({ value: b.id, label: b.name })), [banks]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
        let finalContactId: string = data.contact_id;
        let newContactData: { name: string; type: "vendor" | "client"; } | undefined;

        if (data.contact_id === 'new' && data.newContact) {
             const contactType = data.type === 'payable' ? 'vendor' : 'client';
             newContactData = { name: data.newContact, type: contactType };
             finalContactId = 'new';
        }

        const loanData = {
          contact_id: finalContactId,
          type: data.type,
          principal_amount: data.principal_amount,
          interest_rate: data.interest_rate ?? 0,
          issue_date: formatISO(data.issue_date, { representation: 'date' }),
          due_date: data.due_date ? formatISO(data.due_date, { representation: 'date' }) : undefined,
        }
        
        const disbursementData = {
            method: data.disbursement_method,
            bank_id: data.bank_id,
        }
        
        toast.info("Recording loan...");
        await addLoan(loanData, disbursementData, newContactData);
        
        toast.success("Loan Recorded Successfully");
        setDialogOpen(false);
    } catch (error: any) {
        toast.error("Operation Failed", { description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-0 shadow-none overflow-y-auto pb-8">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-4 px-4 sm:px-6">
            <div className="space-y-2">
                <Label>Loan Type</Label>
                 <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col sm:flex-row pt-2 gap-4">
                            <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="payable" />Payable (I Borrowed)</Label>
                            <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="receivable" />Receivable (I Lent)</Label>
                        </RadioGroup>
                    )}
                    />
                {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>

            {loanType && (
            <div className="space-y-2 animate-fade-in">
                <Label>{loanType === 'payable' ? 'Lender (Vendor)' : 'Borrower (Client)'}</Label>
                <Controller
                    control={control}
                    name="contact_id"
                    render={({ field }) => (
                    <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select a contact" placeholder="Select a contact" items={contactItems} />
                    )}
                />
                {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
                {contact_id === 'new' && (
                    <div className="pt-2 animate-fade-in">
                        <Label htmlFor="newContact">New Contact Name</Label>
                        <Input {...register('newContact')} placeholder="Enter new contact name"/>
                        {errors.newContact && <p className="text-sm text-destructive">{errors.newContact.message}</p>}
                    </div>
                )}
            </div>
            )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="principal_amount">Principal Amount</Label>
              <Input id="principal_amount" type="number" step="0.01" {...register('principal_amount')} placeholder="0.00" />
              {errors.principal_amount && <p className="text-sm text-destructive">{errors.principal_amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="interest_rate">Interest Rate (%)</Label>
              <Input id="interest_rate" type="number" step="0.01" {...register('interest_rate')} placeholder="e.g. 5" />
              {errors.interest_rate && <p className="text-sm text-destructive">{errors.interest_rate.message}</p>}
            </div>
          </div>
          
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Issue Date</Label>
                    <Controller control={control} name="issue_date" render={({ field }) => (
                        <Popover open={issueDatePickerOpen} onOpenChange={setIssueDatePickerOpen}>
                            <PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd-MM-yyyy") : <span>Pick a date</span>}</Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { if (date) field.onChange(date); setIssueDatePickerOpen(false); }} initialFocus /></PopoverContent>
                        </Popover>
                    )} />
                    {errors.issue_date && <p className="text-sm text-destructive">{errors.issue_date.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label>Due Date (Optional)</Label>
                    <Controller control={control} name="due_date" render={({ field }) => (
                        <Popover open={dueDatePickerOpen} onOpenChange={setDueDatePickerOpen}>
                            <PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd-MM-yyyy") : <span>Pick a date</span>}</Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { if (date) field.onChange(date); setDueDatePickerOpen(false); }} /></PopoverContent>
                        </Popover>
                    )} />
                </div>
          </div>
          <Separator />
           <div className="space-y-2">
                <Label>Disbursement Method</Label>
                <Controller
                    control={control}
                    name="disbursement_method"
                    render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col sm:flex-row pt-2 gap-4">
                            <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" />{loanType === 'payable' ? 'Receive in Cash' : 'Disburse from Cash'}</Label>
                            <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" />{loanType === 'payable' ? 'Receive in Bank' : 'Disburse from Bank'}</Label>
                        </RadioGroup>
                    )}
                />
                {errors.disbursement_method && <p className="text-sm text-destructive">{errors.disbursement_method.message}</p>}
            </div>

            {disbursementMethod === 'bank' && (
                <div className="space-y-2 animate-fade-in">
                    <Label>Bank Account</Label>
                    <Controller
                        control={control}
                        name="bank_id"
                        render={({ field }) => (
                            <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select a bank account" placeholder="Select a bank account" items={bankAccountItems} />
                        )}
                    />
                    {errors.bank_id && <p className="text-sm text-destructive">{errors.bank_id.message}</p>}
                </div>
            )}
        </CardContent>
        <CardFooter className="flex justify-end p-4 sm:p-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Loan
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
