
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
import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const formSchema = z.object({
  paymentMethod: z.enum(['cash', 'bank'], { required_error: "Please select a payment method." }),
  paymentDate: z.date({ required_error: "Please select a payment date." }),
  paymentAmount: z.coerce.number().positive("Payment amount must be positive."),
  transactionId: z.string({ required_error: "Please select a transaction to settle." }),
});

type FormData = z.infer<typeof formSchema>;

interface SettlePaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  transactions: LedgerTransaction[];
  contactName: string;
}

export function SettlePaymentDialog({ isOpen, setIsOpen, transactions, contactName }: SettlePaymentDialogProps) {
    const { recordInstallment, currency } = useAppContext();
    const { toast } = useToast();
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

    const selectedTransaction = useMemo(() => {
        return transactions.find(tx => tx.id === selectedTxId);
    }, [transactions, selectedTxId]);

    const remainingBalance = selectedTransaction ? selectedTransaction.amount - selectedTransaction.paid_amount : 0;
    
    const { control, handleSubmit, register, formState: { errors, isSubmitting }, setValue, watch } = useForm<FormData>({
        resolver: zodResolver(formSchema.refine(data => {
            if (!selectedTransaction) return false;
            const balance = selectedTransaction.amount - selectedTransaction.paid_amount;
            return data.paymentAmount <= balance;
        }, {
            message: "Payment cannot exceed the remaining balance for the selected transaction.",
            path: ["paymentAmount"],
        })),
        defaultValues: {
            paymentDate: new Date(),
        },
    });

    const transactionId = watch('transactionId');

    useState(() => {
        if(transactionId) {
            const tx = transactions.find(t => t.id === transactionId);
            if(tx) {
                setValue('paymentAmount', tx.amount - tx.paid_amount);
            }
        }
    }, [transactionId, transactions, setValue]);


    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `৳${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const onSubmit = async (data: FormData) => {
        const transactionToSettle = transactions.find(tx => tx.id === data.transactionId);
        if (!transactionToSettle) {
            toast({ variant: 'destructive', title: 'Error', description: 'Selected transaction not found.' });
            return;
        }

        try {
            await recordInstallment(transactionToSettle, data.paymentAmount, data.paymentMethod, data.paymentDate);
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payment Failed', description: error.message });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Payment for {contactName}</DialogTitle>
                    <DialogDescription>
                        Select a transaction to record a full or partial payment.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                           <Label htmlFor="transactionId">Outstanding Transaction</Label>
                           <Controller
                                control={control}
                                name="transactionId"
                                render={({ field }) => (
                                    <Select onValueChange={(value) => {
                                        field.onChange(value);
                                        const tx = transactions.find(t => t.id === value);
                                        if (tx) {
                                            setValue('paymentAmount', tx.amount - tx.paid_amount);
                                        }
                                    }} value={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a bill or invoice" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {transactions.map(tx => (
                                        <SelectItem key={tx.id} value={tx.id}>
                                            {`${format(new Date(tx.date), 'dd-MM-yy')} - ${tx.description} (${formatCurrency(tx.amount - tx.paid_amount)} due)`}
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.transactionId && <p className="text-sm text-destructive">{errors.transactionId.message}</p>}
                        </div>
                        
                        {transactionId && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                <div className="space-y-2">
                                    <Label htmlFor="paymentAmount">Payment Amount</Label>
                                    <Input id="paymentAmount" type="number" step="0.01" {...register('paymentAmount')} />
                                    {errors.paymentAmount && <p className="text-sm text-destructive">{errors.paymentAmount.message}</p>}
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
                            </div>
                        )}
                        
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


                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Record Payment
                            </Button>
                        </DialogFooter>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
