
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
import { useAppContext } from '@/app/store';
import type { LedgerTransaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';

const formSchema = z.object({
  paymentMethod: z.enum(['cash', 'bank'], { required_error: "Please select a payment method." }),
  paymentDate: z.date({ required_error: "Please select a payment date." }),
  paymentAmount: z.coerce.number().positive("Payment amount must be positive."),
});

type FormData = z.infer<typeof formSchema>;

interface SettlePaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  transaction: LedgerTransaction;
}

export function SettlePaymentDialog({ isOpen, setIsOpen, transaction }: SettlePaymentDialogProps) {
    const { recordInstallment, currency } = useAppContext();
    const { toast } = useToast();
    const remainingBalance = transaction.amount - transaction.paid_amount;
    
    const { control, handleSubmit, register, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(formSchema.refine(data => data.paymentAmount <= remainingBalance, {
            message: "Payment cannot exceed the remaining balance.",
            path: ["paymentAmount"],
        })),
        defaultValues: {
            paymentDate: new Date(),
            paymentAmount: remainingBalance,
        },
    });

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const onSubmit = async (data: FormData) => {
        try {
            await recordInstallment(transaction, data.paymentAmount, data.paymentMethod, data.paymentDate);
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payment Failed', description: error.message });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                        Record a full or partial payment for this {transaction.type}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact:</span>
                        <span className="font-medium">{transaction.contact_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Description:</span>
                        <span className="font-medium">{transaction.description}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Bill:</span>
                        <span className="font-bold">{formatCurrency(transaction.amount)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Already Paid:</span>
                        <span className="font-medium text-green-600">{formatCurrency(transaction.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between text-base">
                        <span className="text-muted-foreground">Balance Due:</span>
                        <span className="font-bold text-lg text-destructive">{formatCurrency(remainingBalance)}</span>
                    </div>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                     <div className="space-y-2">
                        <Label htmlFor="paymentAmount">Payment Amount</Label>
                        <Input id="paymentAmount" type="number" step="0.01" {...register('paymentAmount')} />
                        {errors.paymentAmount && <p className="text-sm text-destructive">{errors.paymentAmount.message}</p>}
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

                    <div className="space-y-2">
                        <Label>Payment Date</Label>
                        <Controller
                            control={control}
                            name="paymentDate"
                            render={({ field }) => (
                                <Popover>
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
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                         {errors.paymentDate && <p className="text-sm text-destructive">{errors.paymentDate.message}</p>}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Record Payment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

    
