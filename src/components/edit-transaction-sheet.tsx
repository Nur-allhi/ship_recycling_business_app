
"use client";

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
import { Pencil } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import type { CashTransaction, BankTransaction, StockTransaction } from '@/lib/types';
import { useEffect, useMemo } from 'react';

const formSchema = z.object({
  amount: z.coerce.number().positive({ message: 'Amount must be positive.' }),
  description: z.string().min(1, 'Description is required.'),
  category: z.string(),
  inOutType: z.enum(['in', 'out']),
});

type FormData = z.infer<typeof formSchema>;

interface EditTransactionSheetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  transaction: CashTransaction | BankTransaction | StockTransaction;
  transactionType: 'cash' | 'bank' | 'stock';
}

export function EditTransactionSheet({ isOpen, setIsOpen, transaction, transactionType }: EditTransactionSheetProps) {
  const { 
    editCashTransaction, 
    editBankTransaction,
    cashCategories,
    bankCategories,
  } = useAppContext();
  
  const { toast } = useToast();

  const isCash = transactionType === 'cash';
  const isBank = transactionType === 'bank';
  
  const defaultValues = useMemo(() => {
    if (isCash || isBank) {
      const tx = transaction as CashTransaction | BankTransaction;
      return {
        amount: tx.amount,
        description: tx.description,
        category: tx.category,
        inOutType: tx.type === 'income' || tx.type === 'deposit' ? 'in' : 'out',
      }
    }
    return { amount: 0, description: '', category: '', inOutType: 'in' as 'in'|'out'};
  }, [transaction, isCash, isBank]);


  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues
  });
  
  useEffect(() => {
      setValue('amount', defaultValues.amount);
      setValue('description', defaultValues.description);
      setValue('category', defaultValues.category);
      setValue('inOutType', defaultValues.inOutType);
  }, [defaultValues, setValue]);


  const onSubmit = (data: FormData) => {
    if (!transaction) return;

    if (isCash) {
      editCashTransaction(transaction as CashTransaction, {
        type: data.inOutType === 'in' ? 'income' : 'expense',
        amount: data.amount,
        description: data.description,
        category: data.category,
      });
    } else if (isBank) {
      editBankTransaction(transaction as BankTransaction, {
        type: data.inOutType === 'in' ? 'deposit' : 'withdrawal',
        amount: data.amount,
        description: data.description,
        category: data.category,
      });
    }

    toast({ title: "Transaction Updated", description: "Your transaction has been successfully updated." });
    setIsOpen(false);
  };
  
  if (transactionType === 'stock') {
    // Editing stock transactions is complex and deferred.
    return null;
  }

  const currentCategories = isCash ? cashCategories : bankCategories;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
                <SheetTitle className="flex items-center"><Pencil className="mr-2 h-6 w-6" /> Edit Transaction</SheetTitle>
                <SheetDescription>Update the details of this transaction.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" step="0.01" {...register('amount')} />
                    {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" {...register('description')} />
                    {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Category</Label>
                    <Controller
                        control={control}
                        name="category"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                <SelectContent>
                                    {currentCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Direction</Label>
                    <Controller 
                        control={control}
                        name="inOutType"
                        render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex pt-2 gap-4">
                                <Label className="flex items-center gap-2 cursor-pointer">
                                    <RadioGroupItem value="in" />
                                    {isCash ? 'Income' : 'Deposit'}
                                </Label>
                                <Label className="flex items-center gap-2 cursor-pointer">
                                    <RadioGroupItem value="out" />
                                    {isCash ? 'Expense' : 'Withdrawal'}
                                </Label>
                            </RadioGroup>
                        )}
                    />
                    {errors.inOutType && <p className="text-sm text-destructive">{errors.inOutType.message}</p>}
                </div>

                <Button type="submit" className="w-full sm:w-auto">Save Changes</Button>
            </form>
        </SheetContent>
    </Sheet>
  );
}
