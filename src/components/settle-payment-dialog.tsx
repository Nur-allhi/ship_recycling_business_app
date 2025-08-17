
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
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';

interface AggregatedContact {
    contact_id: string;
    contact_name: string;
    total_amount: number;
    total_paid: number;
    type: 'payable' | 'receivable';
}

const formSchema = z.object({
  paymentMethod: z.enum(['cash', 'bank'], { required_error: "Please select a payment method." }),
  paymentDate: z.date({ required_error: "Please select a payment date." }),
  paymentAmount: z.coerce.number().positive("Payment amount must be positive."),
});

type FormData = z.infer<typeof formSchema>;

interface SettlePaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  contact: AggregatedContact;
}

export function SettlePaymentDialog({ isOpen, setIsOpen, contact }: SettlePaymentDialogProps) {
    const { recordPayment, currency } = useAppContext();
    const { toast } = useToast();
    
    const remainingBalance = contact.total_amount - contact.total_paid;

    const { control, handleSubmit, register, formState: { errors, isSubmitting }} = useForm<FormData>({
        resolver: zodResolver(formSchema.refine(data => {
            return data.paymentAmount <= remainingBalance;
        }, {
            message: "Payment cannot exceed the remaining balance.",
            path: ["paymentAmount"],
        })),
        defaultValues: {
            paymentDate: new Date(),
            paymentAmount: remainingBalance
        },
    });

    const formatCurrency = (amount: number) => {
        if (currency === 'BDT') {
            return `BDT ${new Intl.NumberFormat('en-US').format(amount)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
    }

    const onSubmit = async (data: FormData) => {
        try {
            await recordPayment(contact.contact_id, contact.contact_name, data.paymentAmount, data.paymentMethod, data.paymentDate, contact.type);
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payment Failed', description: error.message });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Payment for {contact.contact_name}</DialogTitle>
                    <DialogDescription>
                        The total outstanding balance is <span className="font-bold">{formatCurrency(remainingBalance)}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
