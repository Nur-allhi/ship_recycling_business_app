
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppContext } from '@/app/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  transactionType: z.enum(['cash', 'bank', 'stock_purchase', 'stock_sale', 'transfer']),
  amount: z.coerce.number().positive({ message: 'Amount must be positive.' }),
  description: z.string().optional(),
  category: z.string().optional(),
  date: z.date(),
  
  // stock specific
  stockItemName: z.string().optional(),
  weight: z.coerce.number().optional(),
  pricePerKg: z.coerce.number().optional(),
  paymentMethod: z.enum(['cash', 'bank']).optional(),

  // cash/bank specific
  inOutType: z.enum(['in', 'out']).optional(),

  // transfer specific
  transferFrom: z.enum(['cash', 'bank']).optional(),

}).superRefine((data, ctx) => {
    if (data.transactionType === 'stock_purchase' || data.transactionType === 'stock_sale') {
        if (!data.stockItemName) {
            ctx.addIssue({ code: 'custom', message: 'Stock item name is required.', path: ['stockItemName'] });
        }
        if (!data.weight || data.weight <= 0) {
            ctx.addIssue({ code: 'custom', message: 'Weight must be positive.', path: ['weight'] });
        }
        if (!data.pricePerKg || data.pricePerKg <= 0) {
            ctx.addIssue({ code: 'custom', message: 'Price must be positive.', path: ['pricePerKg'] });
        }
        if (!data.paymentMethod) {
            ctx.addIssue({ code: 'custom', message: 'Payment method is required.', path: ['paymentMethod'] });
        }
    }
    if(data.transactionType === 'cash' || data.transactionType === 'bank') {
        if (!data.inOutType) {
            ctx.addIssue({ code: 'custom', message: 'Transaction direction is required.', path: ['inOutType'] });
        }
        if (!data.category) {
            ctx.addIssue({ code: 'custom', message: 'Category is required.', path: ['category'] });
        }
         if (!data.description) {
            ctx.addIssue({ code: 'custom', message: 'Description is required.', path: ['description'] });
        }
    }
    if(data.transactionType === 'transfer') {
        if (!data.transferFrom) {
            ctx.addIssue({ code: 'custom', message: 'Transfer source is required.', path: ['transferFrom'] });
        }
    }
});


type FormData = z.infer<typeof formSchema>;

interface UnifiedTransactionFormProps {
  setSheetOpen: (open: boolean) => void;
}

const cashIncomeCategories = ['Salary'];
const cashExpenseCategories = ['Groceries', 'Transport', 'Utilities'];
const bankDepositCategories = ['Deposit'];
const bankWithdrawalCategories = ['Withdrawal'];

export function UnifiedTransactionForm({ setSheetOpen }: UnifiedTransactionFormProps) {
  const { 
    addCashTransaction, 
    addBankTransaction, 
    addStockTransaction, 
    transferFunds,
    cashCategories,
    bankCategories,
    stockItems
  } = useAppContext();
  
  const { toast } = useToast();
  
  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        amount: undefined,
        description: "",
        date: new Date(),
    }
  });

  const transactionType = watch('transactionType');
  const category = watch('category');
  const [showDirection, setShowDirection] = useState(false);

  useEffect(() => {
    if (transactionType === 'cash' && category) {
      if (cashIncomeCategories.includes(category)) {
        setValue('inOutType', 'in');
        setShowDirection(false);
      } else if (cashExpenseCategories.includes(category)) {
        setValue('inOutType', 'out');
        setShowDirection(false);
      } else {
        setValue('inOutType', undefined);
        setShowDirection(true);
      }
    } else if (transactionType === 'bank' && category) {
        if (bankDepositCategories.includes(category)) {
            setValue('inOutType', 'in');
            setShowDirection(false);
        } else if (bankWithdrawalCategories.includes(category)) {
            setValue('inOutType', 'out');
            setShowDirection(false);
        } else {
            setValue('inOutType', undefined);
            setShowDirection(true);
        }
    } else {
        setShowDirection(false);
    }
  }, [category, transactionType, setValue]);


  const onSubmit = (data: FormData) => {
    const transactionDate = data.date.toISOString();
    switch(data.transactionType) {
        case 'cash':
            addCashTransaction({
                type: data.inOutType === 'in' ? 'income' : 'expense',
                amount: data.amount,
                description: data.description!,
                category: data.category!,
                date: transactionDate,
            });
            break;
        case 'bank':
             addBankTransaction({
                type: data.inOutType === 'in' ? 'deposit' : 'withdrawal',
                amount: data.amount,
                description: data.description!,
                category: data.category!,
                date: transactionDate,
            });
            break;
        case 'stock_purchase':
            addStockTransaction({
                type: 'purchase',
                stockItemName: data.stockItemName!,
                weight: data.weight!,
                pricePerKg: data.pricePerKg!,
                paymentMethod: data.paymentMethod!,
                description: data.description,
                date: transactionDate,
            });
            break;
        case 'stock_sale':
             addStockTransaction({
                type: 'sale',
                stockItemName: data.stockItemName!,
                weight: data.weight!,
                pricePerKg: data.pricePerKg!,
                paymentMethod: data.paymentMethod!,
                description: data.description,
                date: transactionDate,
            });
            break;
        case 'transfer':
            transferFunds(data.transferFrom!, data.amount, transactionDate);
            break;
    }
    toast({ title: "Transaction Added", description: "Your transaction has been successfully recorded." });
    reset();
    setSheetOpen(false);
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center"><PlusCircle className="mr-2 h-6 w-6" /> Add a New Transaction</SheetTitle>
        <SheetDescription>A single place to record any cash, bank, or stock transaction.</SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Controller
                  control={control}
                  name="transactionType"
                  rules={{ required: true }}
                  render={({ field }) => (
                      <Select onValueChange={(value) => {
                          field.onChange(value);
                          // Reset dependent fields when type changes
                          setValue('category', undefined);
                          setValue('inOutType', undefined);
                      }} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="Select a transaction type..." /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="cash">Cash Transaction</SelectItem>
                              <SelectItem value="bank">Bank Transaction</SelectItem>
                              <SelectItem value="stock_purchase">Stock Purchase</SelectItem>
                              <SelectItem value="stock_sale">Stock Sale</SelectItem>
                              <SelectItem value="transfer">Fund Transfer</SelectItem>
                          </SelectContent>
                      </Select>
                  )}
              />
              {errors.transactionType && <p className="text-sm text-destructive">{errors.transactionType.message}</p>}
          </div>

          {transactionType && (
               <>
                  {/* Common Fields */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Amount</Label>
                          <Input id="amount" type="number" step="0.01" {...register('amount')} placeholder="0.00"/>
                          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Controller
                                control={control}
                                name="date"
                                render={({ field }) => (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
                        </div>
                   </div>
                  {(transactionType === 'cash' || transactionType === 'bank' || transactionType === 'stock_purchase' || transactionType === 'stock_sale') && (
                      <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Input id="description" {...register('description')} placeholder={transactionType.startsWith('stock') ? "Optional notes" : "e.g., Weekly groceries"} />
                          {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                      </div>
                  )}


                  {/* Cash/Bank Specific */}
                  {(transactionType === 'cash' || transactionType === 'bank') && (
                      <div className="space-y-4">
                          <div className="space-y-2">
                              <Label>Category</Label>
                              <Controller
                                  control={control}
                                  name="category"
                                  render={({ field }) => (
                                      <Select onValueChange={field.onChange} value={field.value}>
                                          <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                          <SelectContent>
                                              {(transactionType === 'cash' ? cashCategories : bankCategories).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                  )}
                              />
                              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                          </div>

                         {showDirection && (
                           <div className="space-y-2">
                              <Label>Direction</Label>
                              <Controller 
                                  control={control}
                                  name="inOutType"
                                  render={({ field }) => (
                                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex pt-2 gap-4">
                                          <Label htmlFor="in" className="flex items-center gap-2 cursor-pointer">
                                              <RadioGroupItem value="in" id="in" />
                                              In
                                          </Label>
                                          <Label htmlFor="out" className="flex items-center gap-2 cursor-pointer">
                                              <RadioGroupItem value="out" id="out" />
                                              Out
                                          </Label>
                                      </RadioGroup>
                                  )}
                              />
                              {errors.inOutType && <p className="text-sm text-destructive">{errors.inOutType.message}</p>}
                          </div>
                         )}
                      </div>
                  )}

                  {/* Stock Specific */}
                  {(transactionType === 'stock_purchase' || transactionType === 'stock_sale') && (
                     <>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label>Item Name</Label>
                              {transactionType === 'stock_purchase' ? (
                                   <Input {...register('stockItemName')} placeholder="e.g. Rice"/>
                              ) : (
                                  <Controller
                                      control={control}
                                      name="stockItemName"
                                      render={({ field }) => (
                                          <Select onValueChange={field.onChange} value={field.value}>
                                              <SelectTrigger><SelectValue placeholder="Select item to sell" /></SelectTrigger>
                                              <SelectContent>
                                                  {stockItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                                              </SelectContent>
                                          </Select>
                                      )}
                                  />
                              )}
                              {errors.stockItemName && <p className="text-sm text-destructive">{errors.stockItemName.message}</p>}
                          </div>
                          <div className="space-y-2">
                              <Label>Payment Method</Label>
                               <Controller 
                                  control={control}
                                  name="paymentMethod"
                                  render={({ field }) => (
                                       <RadioGroup onValueChange={field.onChange} value={field.value} className="flex pt-2 gap-4">
                                          <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" id="cash" /><span>Cash</span></Label>
                                          <Label htmlFor="bank" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" id="bank" /><span>Bank</span></Label>
                                      </RadioGroup>
                                  )}
                              />
                              {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                          </div>
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <Label>Weight (kg)</Label>
                              <Input type="number" step="0.01" {...register('weight')} placeholder="0.00"/>
                              {errors.weight && <p className="text-sm text-destructive">{errors.weight.message}</p>}
                          </div>
                          <div className="space-y-2">
                              <Label>Price per kg</Label>
                              <Input type="number" step="0.01" {...register('pricePerKg')} placeholder="0.00"/>
                              {errors.pricePerKg && <p className="text-sm text-destructive">{errors.pricePerKg.message}</p>}
                          </div>
                      </div>
                     </>
                  )}

                  {/* Transfer Specific */}
                  {transactionType === 'transfer' && (
                      <div className="space-y-2">
                          <Label>Transfer from</Label>
                              <Controller 
                                  control={control}
                                  name="transferFrom"
                                  render={({ field }) => (
                                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex pt-2 gap-4">
                                          <Label htmlFor="from_cash" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" id="from_cash" /><span>Cash to Bank</span></Label>
                                          <Label htmlFor="from_bank" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="bank" id="from_bank" /><span>Bank to Cash</span></Label>
                                      </RadioGroup>
                                  )}
                              />
                          {errors.transferFrom && <p className="text-sm text-destructive">{errors.transferFrom.message}</p>}
                      </div>
                  )}
                  <Button type="submit" className="w-full sm:w-auto">Record Transaction</Button>
               </>
          )}

      </form>
    </>
  );
}
