
"use client";

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/app/context/app-context';
import { useAppActions } from '@/app/context/app-actions';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { ResponsiveSelect } from './ui/responsive-select';
import { useState } from 'react';

// Helper to format date as YYYY-MM-DD string, preserving the local date
const toYYYYMMDD = (date: Date) => {
    const d = new Date(date);
    // Adjust for timezone offset to prevent the date from changing
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

interface AggregatedContact {
    contact_id: string;
    contact_name: string;
    type: 'payable' | 'receivable';
}

const formSchema = z.object({
  paymentMethod: z.enum(['cash', 'bank'], { required_error: "Please select a payment method." }),
  paymentDate: z.date({ required_error: "Please select a payment date." }),
  paymentAmount: z.coerce.number().positive("Payment amount must be positive."),
  bank_id: z.string().optional(),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.paymentMethod === 'bank' && !data.bank_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['bank_id'],
            message: 'A bank account is required for bank payments.',
        });
    }
});

type FormData = z.infer<typeof formSchema>;

interface RecordAdvanceDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  contact: AggregatedContact;
  ledgerType: 'payable' | 'receivable';
}

export function RecordAdvanceDialog({ isOpen, setIsOpen, contact, ledgerType }: RecordAdvanceDialogProps) {
    const { currency, banks } = useAppContext();
    const { recordAdvancePayment } = useAppActions();
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const { control, handleSubmit, register, watch, formState: { errors, isSubmitting }} = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            paymentDate: new Date(),
        },
    });

    const paymentMethod = watch('paymentMethod');
    
    const onSubmit = async (data: FormData) => {
        try {
            await recordAdvancePayment({
                contact_id: contact.contact_id,
                contact_name: contact.contact_name,
                amount: data.paymentAmount,
                date: data.paymentDate,
                payment_method: data.paymentMethod,
                ledger_type: ledgerType,
                bank_id: data.bank_id,
                description: data.description,
            });
            toast.success("Advance Payment Recorded");
            setIsOpen(false);
        } catch (error: any) {
            toast.error('Failed to Record Advance', { description: error.message });
        }
    };
    
    const bankAccountItems = banks.map(b => ({ value: b.id, label: b.name }));

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Advance for {contact.contact_name}</DialogTitle>
                    <DialogDescription>
                        {ledgerType === 'payable' ? 'Record an advance payment made to this vendor.' : 'Record an advance payment received from this client.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="paymentAmount">Amount</Label>
                            <Input id="paymentAmount" type="number" step="0.01" {...register('paymentAmount')} />
                            {errors.paymentAmount && <p className="text-sm text-destructive">{errors.paymentAmount.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Controller
                                control={control}
                                name="paymentDate"
                                render={({ field }) => (
                                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar 
                                                mode="single" 
                                                selected={field.value} 
                                                onSelect={(date) => {
                                                  if (date) field.onChange(date);
                                                  setIsDatePickerOpen(false);
                                                }} 
                                                initialFocus 
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                            {errors.paymentDate && <p className="text-sm text-destructive">{errors.paymentDate.message}</p>}
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Pay from / into</Label>
                        <Controller 
                            control={control}
                            name="paymentMethod"
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex pt-2 gap-4">
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" />Cash</Label>
                                    <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" />Bank</Label>
                                </RadioGroup>
                            )}
                        />
                        {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                    </div>

                    {paymentMethod === 'bank' && (
                        <div className="space-y-2 animate-fade-in">
                            <Label>Bank Account</Label>
                            <Controller 
                                control={control}
                                name="bank_id"
                                render={({ field }) => (
                                    <ResponsiveSelect
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        title="Select a Bank Account"
                                        placeholder="Select a bank..."
                                        items={bankAccountItems}
                                    />
                                )}
                            />
                            {errors.bank_id && <p className="text-sm text-destructive">{errors.bank_id.message}</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Input id="description" {...register('description')} placeholder="e.g., Down payment for order #123" />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Record Advance
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
