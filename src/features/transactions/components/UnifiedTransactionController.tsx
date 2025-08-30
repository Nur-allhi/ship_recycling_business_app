"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Wallet, Landmark, Boxes, ArrowRightLeft, UserPlus, Loader2 } from 'lucide-react';
import { useAppActions } from '@/app/context/app-actions';
import { useAppContext } from '@/app/context/app-context';
import { Button } from '@/components/ui/button';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';

// Import validation schemas
import { createTransactionSchema, TransactionType } from '@/features/transactions/validation/transaction.schema';

// Import form components
import { CashForm } from '@/features/transactions/components/CashForm';
import { BankForm } from '@/features/transactions/components/BankForm';
import { StockForm } from '@/features/transactions/components/StockForm';
import { TransferForm } from '@/features/transactions/components/TransferForm';
import { ApArForm } from '@/features/transactions/components/ApArForm';

interface UnifiedTransactionFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function UnifiedTransactionForm({ setDialogOpen }: UnifiedTransactionFormProps) {
  // State management
  const [transactionType, setTransactionType] = useState<TransactionType>('cash');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isCashSettlement, setIsCashSettlement] = useState(false);
  const [isBankSettlement, setIsBankSettlement] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [showStockContact, setShowStockContact] = useState(false);
  const [isNewStockItem, setIsNewStockItem] = useState(false);

  const isMobile = useIsMobile();

  // App context and actions
  const {
    addCashTransaction,
    addBankTransaction,
    addStockTransaction,
    addLedgerTransaction,
    addVendor,
    addClient,
    transferFunds,
  } = useAppActions();

  const {
    cashCategories,
    bankCategories,
    stockItems,
    vendors,
    clients,
    banks,
    currency,
  } = useAppContext();

  // Dynamic schema based on transaction type
  const currentSchema = useMemo(() => {
    return createTransactionSchema(transactionType);
  }, [transactionType]);

  // Form setup
  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(currentSchema as any),
    defaultValues: {
      date: new Date(),
      payLater: false,
    }
  });

  // Form watches
  const watchedAmount = useWatch({ control, name: 'amount' });
  const watchedExpectedAmount = useWatch({ control, name: 'expected_amount' });
  const watchedActualAmount = useWatch({ control, name: 'actual_amount' });
  const stockType = useWatch({ control, name: 'stockType' });
  const stockPaymentMethod = useWatch({ control, name: 'paymentMethod' });
  const ledgerType = useWatch({ control, name: 'ledgerType' });
  const contact_id = useWatch({ control, name: 'contact_id' });
  const transferFrom = useWatch({ control, name: 'transferFrom' });
  const cashCategoryName = useWatch({ control, name: 'category' });
  const bankCategoryName = useWatch({ control, name: 'category' });
  const weight = useWatch({ control, name: 'weight' });
  const pricePerKg = useWatch({ control, name: 'pricePerKg' });
  const payLater = watch('payLater');

  // Computed values
  const cashCategoryInfo = useMemo(() => 
    (cashCategories || []).find(c => c.name === cashCategoryName), 
    [cashCategories, cashCategoryName]
  );
  
  const bankCategoryInfo = useMemo(() => 
    (bankCategories || []).find(c => c.name === bankCategoryName), 
    [bankCategories, bankCategoryName]
  );
  
  const isExpense = (
    (transactionType === 'cash' && cashCategoryInfo?.direction === 'debit') || 
    (transactionType === 'bank' && bankCategoryInfo?.direction === 'debit')
  );

  const difference = useMemo(() => {
    const expected = parseFloat(watchedExpectedAmount || 0);
    const actual = parseFloat(watchedActualAmount || 0);
    if (isNaN(expected) || isNaN(actual) || !showAdvancedFields) {
      return 0;
    }
    return actual - expected;
  }, [watchedExpectedAmount, watchedActualAmount, showAdvancedFields]);

  // Effects
  useEffect(() => {
    // When the user is in simple mode, keep both amounts in sync
    if (!showAdvancedFields && typeof watchedAmount === 'number') {
      setValue('expected_amount', watchedAmount);
      setValue('actual_amount', watchedAmount);
    }
  }, [watchedAmount, showAdvancedFields, setValue]);

  useEffect(() => {
    const isSettlement = cashCategoryName === 'A/R Settlement' || cashCategoryName === 'A/P Settlement';
    setIsCashSettlement(isSettlement);
  }, [cashCategoryName]);

  useEffect(() => {
    const isSettlement = bankCategoryName === 'A/R Settlement' || bankCategoryName === 'A/P Settlement';
    setIsBankSettlement(isSettlement);
  }, [bankCategoryName]);

  useEffect(() => {
    if (transactionType === 'stock' && weight && pricePerKg) {
      const calculatedAmount = weight * pricePerKg;
      setValue('expected_amount', calculatedAmount);
      if (watch('actual_amount') === undefined || watch('actual_amount') === calculatedAmount) {
        setValue('actual_amount', calculatedAmount);
      }
    }
  }, [weight, pricePerKg, setValue, watch, transactionType]);

  // Form submission handler
  const onSubmit = async (data: any) => {
    try {
      // Handle new contact creation if needed
      if (data.contact_id === 'new' && data.newContact) {
        const contactName = data.newContact.trim();
        let newContact;
        
        if (isExpense || transactionType === 'ap_ar' && ledgerType === 'payable') {
          newContact = await addVendor(contactName);
        } else {
          newContact = await addClient(contactName);
        }
        
        if (newContact && newContact.id) {
          data.contact_id = newContact.id.toString();
        }
      }

      // Ensure expected_amount is always included for transactions
      if (!data.expected_amount && data.amount) {
        data.expected_amount = data.amount;
      }
      if (!data.actual_amount && data.amount) {
        data.actual_amount = data.amount;
      }

      // Handle different transaction types
      switch (transactionType) {
        case 'cash':
          await addCashTransaction({
            ...data,
            type: isExpense ? 'expense' : 'income'
          });
          break;
          
        case 'bank':
          await addBankTransaction({
            ...data,
            type: isExpense ? 'withdrawal' : 'deposit'
          });
          break;
          
        case 'stock':
          await addStockTransaction(data);
          break;
          
        case 'transfer':
          const bankId = data.transferFrom === 'cash' ? data.transferToBankId : data.transferFromBankId;
          await transferFunds(data.transferFrom, data.amount, data.date, bankId, data.description);
          break;
          
        case 'ap_ar':
          await addLedgerTransaction(data);
          break;
          
        default:
          throw new Error(`Unknown transaction type: ${transactionType}`);
      }

      toast.success('Transaction added successfully!');
      reset();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Transaction submission error:', error);
      toast.error(error.message || 'Failed to add transaction');
    }
  };

  // Reset form when transaction type changes
  useEffect(() => {
    reset({
      date: new Date(),
      payLater: false,
    });
  }, [transactionType, reset]);

  // Tab configuration
  const tabs = [
    { id: 'cash', label: 'Cash', icon: Wallet },
    { id: 'bank', label: 'Bank', icon: Landmark },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
    { id: 'ap_ar', label: 'A/P & A/R', icon: UserPlus },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add New Transaction</DialogTitle>
        <DialogDescription>
          Choose a transaction type and fill in the details.
        </DialogDescription>
      </DialogHeader>

      <Separator />

      <Tabs value={transactionType} onValueChange={(value) => setTransactionType(value as TransactionType)} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                {isMobile ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  <div className="flex items-center gap-1">
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </div>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <TabsContent value="cash" className="space-y-4 mt-6">
            <CashForm
              control={control}
              errors={errors}
              watch={watch}
              setValue={setValue}
              isDatePickerOpen={isDatePickerOpen}
              setIsDatePickerOpen={setIsDatePickerOpen}
              showAdvancedFields={showAdvancedFields}
              setShowAdvancedFields={setShowAdvancedFields}
              isCashSettlement={isCashSettlement}
              cashCategories={cashCategories}
              vendors={vendors}
              clients={clients}
              currency={currency}
              watchedAmount={watchedAmount}
              watchedExpectedAmount={watchedExpectedAmount}
              watchedActualAmount={watchedActualAmount}
              difference={difference}
              isExpense={isExpense}
            />
          </TabsContent>

          <TabsContent value="bank" className="space-y-4 mt-6">
            <BankForm
              control={control}
              errors={errors}
              watch={watch}
              setValue={setValue}
              isDatePickerOpen={isDatePickerOpen}
              setIsDatePickerOpen={setIsDatePickerOpen}
              showAdvancedFields={showAdvancedFields}
              setShowAdvancedFields={setShowAdvancedFields}
              isBankSettlement={isBankSettlement}
              bankCategories={bankCategories}
              banks={banks}
              vendors={vendors}
              clients={clients}
              currency={currency}
              watchedAmount={watchedAmount}
              watchedExpectedAmount={watchedExpectedAmount}
              watchedActualAmount={watchedActualAmount}
              difference={difference}
              isExpense={isExpense}
            />
          </TabsContent>

          <TabsContent value="stock" className="space-y-4 mt-6">
            <StockForm
              control={control}
              errors={errors}
              watch={watch}
              setValue={setValue}
              isDatePickerOpen={isDatePickerOpen}
              setIsDatePickerOpen={setIsDatePickerOpen}
              showStockContact={showStockContact}
              setShowStockContact={setShowStockContact}
              isNewStockItem={isNewStockItem}
              setIsNewStockItem={setIsNewStockItem}
              stockItems={stockItems || []}
              banks={banks}
              vendors={vendors}
              clients={clients}
              currency={currency}
              watchedExpectedAmount={watchedExpectedAmount}
              watchedActualAmount={watchedActualAmount}
              difference={difference}
            />
          </TabsContent>

          <TabsContent value="transfer" className="space-y-4 mt-6">
            <TransferForm
              control={control}
              errors={errors}
              watch={watch}
              isDatePickerOpen={isDatePickerOpen}
              setIsDatePickerOpen={setIsDatePickerOpen}
              banks={banks}
              currency={currency}
            />
          </TabsContent>

          <TabsContent value="ap_ar" className="space-y-4 mt-6">
            <ApArForm
              control={control}
              errors={errors}
              watch={watch}
              isDatePickerOpen={isDatePickerOpen}
              setIsDatePickerOpen={setIsDatePickerOpen}
              vendors={vendors}
              clients={clients}
              currency={currency}
            />
          </TabsContent>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Transaction
            </Button>
          </div>
        </form>
      </Tabs>
    </>
  );
}