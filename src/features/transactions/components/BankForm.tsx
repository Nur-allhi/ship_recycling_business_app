import React from 'react';
import { Control, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import type { Category, Bank, Vendor, Client } from '@/lib/types';
import { 
  DateField, 
  AmountField, 
  DescriptionField, 
  CategoryField,
  BankField,
  ContactField, 
  NewContactField,
  AdvancedFieldsToggle,
  AdvancedAmountFields
} from './SharedFields';

interface BankFormProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  showAdvancedFields: boolean;
  setShowAdvancedFields: (show: boolean) => void;
  isBankSettlement: boolean;
  bankCategories: Category[];
  banks: Bank[];
  vendors: Vendor[];
  clients: Client[];
  currency: string;
  watchedAmount?: number;
  watchedExpectedAmount?: number;
  watchedActualAmount?: number;
  difference?: number;
  isExpense: boolean;
}

export function BankForm({
  control,
  errors,
  watch,
  setValue,
  isDatePickerOpen,
  setIsDatePickerOpen,
  showAdvancedFields,
  setShowAdvancedFields,
  isBankSettlement,
  bankCategories,
  banks,
  vendors,
  clients,
  currency,
  watchedAmount,
  watchedExpectedAmount,
  watchedActualAmount,
  difference = 0,
  isExpense
}: BankFormProps) {
  const payLater = watch('payLater');
  const contactId = watch('contact_id');

  return (
    <div className="space-y-4">
      <DateField 
        control={control} 
        errors={errors} 
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
      />

      <BankField 
        control={control}
        errors={errors}
        banks={banks}
      />

      <CategoryField 
        control={control}
        errors={errors}
        categories={bankCategories}
        transactionType="bank"
      />

      {!showAdvancedFields && (
        <AmountField 
          control={control}
          errors={errors}
          currency={currency}
        />
      )}

      <DescriptionField 
        control={control}
        errors={errors}
      />

      {!isBankSettlement && (
        <>
          <ContactField 
            control={control}
            errors={errors}
            vendors={vendors}
            clients={clients}
            isExpense={isExpense}
          />

          {contactId === 'new' && (
            <NewContactField 
              control={control}
              errors={errors}
            />
          )}

          <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-md">
            <Controller
              name="payLater"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="payLater"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="payLater" className="cursor-pointer">
              Pay Later (Create A/P Entry)
            </Label>
          </div>

          {payLater && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Pay Later Mode</AlertTitle>
              <AlertDescription>
                This will create an Accounts Payable entry. A vendor must be selected.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {isBankSettlement && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>A/R or A/P Settlement</AlertTitle>
          <AlertDescription>
            You've selected a settlement category. Please ensure you're settling an outstanding balance.
          </AlertDescription>
        </Alert>
      )}

      <AdvancedFieldsToggle 
        showAdvancedFields={showAdvancedFields}
        setShowAdvancedFields={setShowAdvancedFields}
      />

      {showAdvancedFields && (
        <AdvancedAmountFields 
          control={control}
          errors={errors}
          watchedExpectedAmount={watchedExpectedAmount}
          watchedActualAmount={watchedActualAmount}
          difference={difference}
          currency={currency}
        />
      )}
    </div>
  );
}