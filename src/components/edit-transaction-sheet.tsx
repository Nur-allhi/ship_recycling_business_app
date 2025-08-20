
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
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import type { CashTransaction, BankTransaction, StockTransaction } from '@/lib/types';
import { useEffect, useMemo } from 'react';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

const formSchema = z.object({
  // Common
  description: z.string().optional(),
  
  // Cash & Bank
  actual_amount: z.coerce.number().positive().optional(),
  category: z.string().optional(),
  inOutType: z.enum(['in', 'out']).optional(),
  
  // Stock
  stockItemName: z.string().optional(),
  weight: z.coerce.number().positive().optional(),
  pricePerKg: z.coerce.number().positive().optional(),
  paymentMethod: z.enum(['cash', 'bank']).optional(),
  type: z.enum(['purchase', 'sale']).optional(),

}).superRefine((data, ctx) => {
    if(data.type) { // It's a stock transaction
      if (!data.stockItemName) ctx.addIssue({ code: 'custom', message: 'Stock item name is required.', path: ['stockItemName'] });
      if (!data.weight) ctx.addIssue({ code: 'custom', message: 'Weight must be positive.', path: ['weight'] });
      if (!data.pricePerKg) ctx.addIssue({ code: 'custom', message: 'Price must be positive.', path: ['pricePerKg'] });
    } else { // It's a cash/bank transaction
      if (!data.actual_amount) ctx.addIssue({ code: 'custom', message: 'Amount must be positive.', path: ['actual_amount'] });
      if (!data.description) ctx.addIssue({ code: 'custom', message: 'Description is required.', path: ['description'] });
      if (!data.category) ctx.addIssue({ code: 'custom', message: 'Category is required.', path: ['category'] });
      if (!data.inOutType) ctx.addIssue({ code: 'custom', message: 'Direction is required.', path: ['inOutType'] });
    }
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
    editStockTransaction,
    cashCategories,
    bankCategories,
    stockItems,
    reloadData,
  } = useAppContext();
  
  
  const isCash = transactionType === 'cash';
  const isBank = transactionType === 'bank';
  const isStock = transactionType === 'stock';
  
  const defaultValues = useMemo(() => {
    const tx = transaction as any;
    if (isCash || isBank) {
      return {
        actual_amount: tx.actual_amount,
        description: tx.description,
        category: tx.category,
        inOutType: tx.type === 'income' || tx.type === 'deposit' ? 'in' : 'out',
      }
    }
    if (isStock) {
        return {
            stockItemName: tx.stockItemName,
            weight: tx.weight,
            pricePerKg: tx.pricePerKg,
            paymentMethod: tx.paymentMethod,
            type: tx.type,
            description: tx.description || '',
        }
    }
    return {};
  }, [transaction, transactionType, isCash, isBank, isStock]);


  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues
  });
  
  useEffect(() => {
      Object.entries(defaultValues).forEach(([key, value]) => {
          setValue(key as keyof FormData, value);
      })
  }, [defaultValues, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!transaction) return;

    try {
        if (isCash && 'id' in transaction) {
            await editCashTransaction(transaction as CashTransaction, {
                type: data.inOutType === 'in' ? 'income' : 'expense',
                actual_amount: data.actual_amount!,
                description: data.description!,
                category: data.category!,
                lastEdited: new Date().toISOString()
            });
        } else if (isBank && 'id' in transaction) {
            await editBankTransaction(transaction as BankTransaction, {
                type: data.inOutType === 'in' ? 'deposit' : 'withdrawal',
                actual_amount: data.actual_amount!,
                description: data.description!,
                category: data.category!,
                lastEdited: new Date().toISOString()
            });
        } else if (isStock && 'id' in transaction) {
            await editStockTransaction(transaction as StockTransaction, {
                type: data.type!,
                stockItemName: data.stockItemName!,
                weight: data.weight!,
                pricePerKg: data.pricePerKg!,
                description: data.description,
                lastEdited: new Date().toISOString()
            });
        }
        toast.success("Transaction Updated", { description: "The transaction has been successfully updated." });
        setIsOpen(false);
    } catch(e) {
        toast.error("Update failed", { description: "Could not save the transaction changes." });
    }
  };
  
  const currentCategories = isCash ? cashCategories : bankCategories;
  const isStockDerivedTx = (isCash || isBank) && !!(transaction as any).linkedStockTxId;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
                <SheetTitle className="flex items-center"><Pencil className="mr-2 h-6 w-6" /> Edit Transaction</SheetTitle>
                <SheetDescription>
                    { "Update the details of this transaction." }
                </SheetDescription>
            </SheetHeader>
             {isStockDerivedTx && (
                <Alert variant="default" className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-800">
                  <AlertTitle>Linked Transaction</AlertTitle>
                  <AlertDescription>
                    This transaction is linked to a stock movement. Deleting this will also delete the associated stock entry. Editing is restricted to prevent data inconsistency.
                  </AlertDescription>
                </Alert>
              )}
               {isStock && (
                <Alert variant="default" className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-800">
                  <AlertTitle>Editing Caution</AlertTitle>
                  <AlertDescription>
                    Editing this stock transaction will automatically update the linked cash or bank entry if amounts change.
                  </AlertDescription>
                </Alert>
              )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
                
                {(isCash || isBank) && (
                    <>
                        <fieldset disabled={isStockDerivedTx} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="actual_amount">Amount</Label>
                                <Input id="actual_amount" type="number" step="0.01" {...register('actual_amount')} />
                                {errors.actual_amount && <p className="text-sm text-destructive">{errors.actual_amount.message}</p>}
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
                                                {currentCategories.map((c, index) => <SelectItem key={`${c.name}-${index}`} value={c.name}>{c.name}</SelectItem>)}
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
                        </fieldset>
                    </>
                )}

                {isStock && (
                    <>
                        <div className="space-y-2">
                            <Label>Item Name</Label>
                            <Input {...register('stockItemName')} placeholder="e.g. Rice" readOnly className="bg-muted"/>
                            {errors.stockItemName && <p className="text-sm text-destructive">{errors.stockItemName.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                             <Input {...register('type')} readOnly className="bg-muted"/>
                        </div>
                         <div className="space-y-2">
                            <Label>Payment Method</Label>
                             <Controller 
                                control={control}
                                name="paymentMethod"
                                render={({ field }) => (
                                     <RadioGroup onValueChange={field.onChange} value={field.value} className="flex pt-2 gap-4" disabled>
                                        <Label htmlFor="cash" className="flex items-center gap-2 cursor-not-allowed"><RadioGroupItem value="cash" id="cash" /><span>Cash</span></Label>
                                        <Label htmlFor="bank" className="flex items-center gap-2 cursor-not-allowed"><RadioGroupItem value="bank" id="bank" /><span>Bank</span></Label>
                                    </RadioGroup>
                                )}
                            />
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
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input id="description" {...register('description')} placeholder="Optional notes for the transaction" />
                        </div>
                    </>
                )}


                <Button type="submit" className="w-full sm:w-auto" disabled={isStockDerivedTx}>Save Changes</Button>
            </form>
        </SheetContent>
    </Sheet>
  );
}
