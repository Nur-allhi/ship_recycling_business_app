import React from 'react';
import { Control, FieldErrors, UseFormWatch } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ResponsiveSelect } from '@/components/ui/responsive-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Bank } from '@/lib/types';
import { 
  DateField, 
  AmountField
} from './SharedFields';

interface TransferFormProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  watch: UseFormWatch<any>;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  banks: Bank[];
  currency: string;
}

export function TransferForm({
  control,
  errors,
  watch,
  isDatePickerOpen,
  setIsDatePickerOpen,
  banks,
  currency
}: TransferFormProps) {
  const transferFrom = watch('transferFrom');

  return (
    <div className="space-y-4">
      <DateField 
        control={control} 
        errors={errors} 
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
      />

      <AmountField 
        control={control}
        errors={errors}
        currency={currency}
      />

      <div>
        <Label>Transfer From</Label>
        <Controller
          name="transferFrom"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="fromCash" />
                <Label htmlFor="fromCash">Cash to Bank</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bank" id="fromBank" />
                <Label htmlFor="fromBank">Bank to Cash</Label>
              </div>
            </RadioGroup>
          )}
        />
        {errors.transferFrom && <p className="text-sm text-destructive">{errors.transferFrom.message as string}</p>}
      </div>

      {transferFrom === 'cash' && (
        <div>
          <Label>Destination Bank Account</Label>
          <Controller
            name="transferToBankId"
            control={control}
            render={({ field }) => (
              <ResponsiveSelect
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Select destination bank"
                items={banks.map(bank => ({
                  value: bank.id.toString(),
                  label: bank.name
                }))}
              />
            )}
          />
          {errors.transferToBankId && <p className="text-sm text-destructive">{errors.transferToBankId.message as string}</p>}
        </div>
      )}

      {transferFrom === 'bank' && (
        <div>
          <Label>Source Bank Account</Label>
          <Controller
            name="transferFromBankId"
            control={control}
            render={({ field }) => (
              <ResponsiveSelect
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Select source bank"
                items={banks.map(bank => ({
                  value: bank.id.toString(),
                  label: bank.name
                }))}
              />
            )}
          />
          {errors.transferFromBankId && <p className="text-sm text-destructive">{errors.transferFromBankId.message as string}</p>}
        </div>
      )}

      <div>
        <Label>Description (Optional)</Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Enter transfer description"
            />
          )}
        />
      </div>
    </div>
  );
}