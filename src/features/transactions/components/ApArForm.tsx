import React from 'react';
import { Control, FieldErrors, UseFormWatch } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Vendor, Client } from '@/lib/types';
import { 
  DateField, 
  AmountField, 
  DescriptionField,
  ContactField, 
  NewContactField
} from './SharedFields';

interface ApArFormProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  watch: UseFormWatch<any>;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  vendors: Vendor[];
  clients: Client[];
  currency: string;
}

export function ApArForm({
  control,
  errors,
  watch,
  isDatePickerOpen,
  setIsDatePickerOpen,
  vendors,
  clients,
  currency
}: ApArFormProps) {
  const ledgerType = watch('ledgerType');
  const contactId = watch('contact_id');
  const isExpense = ledgerType === 'payable';

  return (
    <div className="space-y-4">
      <DateField 
        control={control} 
        errors={errors} 
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
      />

      <div>
        <Label>Type</Label>
        <Controller
          name="ledgerType"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="payable" id="payable" />
                <Label htmlFor="payable">Accounts Payable (You owe money)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="receivable" id="receivable" />
                <Label htmlFor="receivable">Accounts Receivable (Someone owes you)</Label>
              </div>
            </RadioGroup>
          )}
        />
        {errors.ledgerType && <p className="text-sm text-destructive">{errors.ledgerType.message as string}</p>}
      </div>

      <AmountField 
        control={control}
        errors={errors}
        currency={currency}
      />

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

      <DescriptionField 
        control={control}
        errors={errors}
      />
    </div>
  );
}