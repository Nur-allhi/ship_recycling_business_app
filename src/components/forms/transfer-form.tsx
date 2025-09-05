
"use client";

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';

const transferSchema = z.object({
    date: z.date({ required_error: "Date is required." }),
    amount: z.coerce.number().positive("Amount must be a positive number."),
    transferFrom: z.enum(['cash', 'bank'], { required_error: "Please select transfer source."}),
    transferToBankId: z.string().optional(),
    transferFromBankId: z.string().optional(),
    description: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.transferFrom === 'cash' && !data.transferToBankId) {
        ctx.addIssue({ code: 'custom', message: 'Destination bank is required.', path: ['transferToBankId'] });
    }
    if (data.transferFrom === 'bank' && !data.transferFromBankId) {
        ctx.addIssue({ code: 'custom', message: 'Source bank is required.', path: ['transferFromBankId'] });
    }
});

type FormData = z.infer<typeof transferSchema>;

interface TransferFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function TransferForm({ setDialogOpen }: TransferFormProps) {
  const { transferFunds } = useAppActions();
  const { banks } = useAppContext();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { date: new Date() }
  });

  const transferFrom = watch('transferFrom');

  const onSubmit = async (data: FormData) => {
    const transactionDate = format(data.date, 'yyyy-MM-dd');
    try {
        const bankId = data.transferFrom === 'cash' ? data.transferToBankId : data.transferFromBankId;
        if (!bankId) throw new Error("A bank account must be selected for the transfer.");
        await transferFunds(data.transferFrom, data.amount, transactionDate, bankId, data.description);
        toast.success("Funds Transferred");
        setDialogOpen(false);
    } catch (error: any) {
        toast.error("Operation Failed", { description: error.message });
    }
  };

  const bankAccountItems = useMemo(() => (banks || []).map(b => ({ value: b.id, label: b.name })), [banks]);

  return (
    <Card className="border-0 shadow-none">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-4 px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="amount-transfer">Amount</Label>
              <Input id="amount-transfer" type="number" step="0.01" {...register('amount')} placeholder="0.00" />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description-transfer">Description (Optional)</Label>
            <Input id="description-transfer" {...register('description')} placeholder="e.g., Owner's drawing" />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Transfer Direction</Label>
            <Controller name="transferFrom" control={control} render={({ field }) => (
              <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row pt-2 gap-4">
                <Label htmlFor="from_cash" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" id="from_cash" /><span>Cash to Bank</span></Label>
                <Label htmlFor="from_bank" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" id="from_bank" /><span>Bank to Cash</span></Label>
              </RadioGroup>
            )} />
            {errors.transferFrom && <p className="text-sm text-destructive">{errors.transferFrom.message}</p>}
          </div>
          {transferFrom === 'cash' && (
            <div className="space-y-2 animate-fade-in">
              <Label>To Bank Account</Label>
              <Controller name="transferToBankId" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select destination bank" placeholder="Select a bank account" items={bankAccountItems} />} />
              {errors.transferToBankId && <p className="text-sm text-destructive">{errors.transferToBankId.message}</p>}
            </div>
          )}
          {transferFrom === 'bank' && (
            <div className="space-y-2 animate-fade-in">
              <Label>From Bank Account</Label>
              <Controller name="transferFromBankId" control={control} render={({ field }) => <ResponsiveSelect onValueChange={field.onChange} value={field.value} title="Select source bank" placeholder="Select a bank account" items={bankAccountItems} />} />
              {errors.transferFromBankId && <p className="text-sm text-destructive">{errors.transferFromBankId.message}</p>}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end p-4 sm:p-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer Funds
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
