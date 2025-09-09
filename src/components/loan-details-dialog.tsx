
"use client";

import { useState } from 'react';
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
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { CalendarIcon, Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/app/context/app-context';
import { useAppActions } from '@/app/context/app-actions';
import { toast } from 'sonner';
import { ResponsiveSelect } from './ui/responsive-select';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import type { LoanWithPayments } from '@/lib/types';
import { Badge } from './ui/badge';
import { generateLoanStatementPdf } from '@/lib/pdf-utils';


const paymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'bank'], { required_error: "Please select a payment method." }),
  paymentDate: z.date({ required_error: "Please select a payment date." }),
  paymentAmount: z.coerce.number().positive("Payment amount must be positive."),
  bank_id: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'bank' && !data.bank_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bank_id'],
      message: 'A bank account is required for bank payments.',
    });
  }
});

type FormData = z.infer<typeof paymentSchema>;

interface LoanDetailsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  loan: LoanWithPayments;
}

export function LoanDetailsDialog({ isOpen, setIsOpen, loan }: LoanDetailsDialogProps) {
  const { currency, banks, user, contacts } = useAppContext();
  const { recordLoanPayment } = useAppActions();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingBalance = loan.principal_amount - totalPaid;

  const { control, handleSubmit, register, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(paymentSchema.refine(data => data.paymentAmount <= outstandingBalance, {
      message: "Payment cannot exceed the outstanding balance.",
      path: ["paymentAmount"],
    })),
    defaultValues: {
      paymentDate: new Date(),
      paymentAmount: outstandingBalance > 0 ? outstandingBalance : 0,
    },
  });

  const paymentMethod = watch('paymentMethod');

  const onSubmit = async (data: FormData) => {
    try {
      await recordLoanPayment({
        loan_id: loan.id,
        amount: data.paymentAmount,
        payment_date: format(data.paymentDate, "yyyy-MM-dd"),
        payment_method: data.paymentMethod,
        bank_id: data.bank_id,
        notes: data.notes,
      });
      toast.success("Payment Recorded");
      setIsOpen(false);
    } catch (error: any) {
      toast.error('Failed to Record Payment', { description: error.message });
    }
  };
  
  const formatCurrency = (amount: number) => {
    if (currency === 'BDT') {
      return `৳ ${new Intl.NumberFormat('en-US').format(amount)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(amount)
  }
  
  const handleExportPdf = () => {
    const contact = contacts.find(c => c.id === loan.contact_id);
    generateLoanStatementPdf(loan, contact?.name || 'Unknown', currency);
  };

  const bankAccountItems = banks.map(b => ({ value: b.id, label: b.name }));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Loan Details</DialogTitle>
          <DialogDescription>
            <span>
              Viewing loan details for contact. Status:{" "}
              <Badge className="capitalize ml-1">{loan.status}</Badge>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4 p-4 rounded-lg bg-muted/50 text-center">
                <div>
                    <p className="text-sm text-muted-foreground">Principal</p>
                    <p className="text-lg font-bold font-mono">{formatCurrency(loan.principal_amount)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-lg font-bold font-mono text-green-600">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="text-lg font-bold font-mono text-destructive">{formatCurrency(outstandingBalance)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Interest Rate</p>
                    <p className="text-lg font-bold font-mono">{loan.interest_rate}%</p>
                </div>
            </div>
            
            <Separator />

            <div className="space-y-4">
                <h4 className="font-semibold">Payment History</h4>
                <div className="max-h-48 overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loan.payments.length > 0 ? (
                                loan.payments.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{format(new Date(p.payment_date), 'dd-MM-yyyy')}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-20 text-muted-foreground">No payments recorded yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {isAdmin && outstandingBalance > 0 && (
                <>
                    <Separator />
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <h4 className="font-semibold">Record a New Payment</h4>
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
                        <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                            <Button type="button" variant="outline" onClick={handleExportPdf}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print Statement
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Record Payment
                            </Button>
                        </DialogFooter>
                    </form>
                </>
            )}
        </div>
         {(!isAdmin || outstandingBalance <= 0) && (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleExportPdf}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Statement
                </Button>
                 <Button type="button" onClick={() => setIsOpen(false)}>Close</Button>
              </DialogFooter>
            )}
      </DialogContent>
    </Dialog>
  );
}
