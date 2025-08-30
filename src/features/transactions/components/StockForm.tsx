import React from 'react';
import { Control, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ResponsiveSelect } from '@/components/ui/responsive-select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Info, Plus, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockItem, Bank, Vendor, Client } from '@/lib/types';
import { 
  DateField, 
  BankField,
  ContactField, 
  NewContactField,
  AdvancedAmountFields
} from './SharedFields';

interface StockFormProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  showStockContact: boolean;
  setShowStockContact: (show: boolean) => void;
  isNewStockItem: boolean;
  setIsNewStockItem: (isNew: boolean) => void;
  stockItems: StockItem[];
  banks: Bank[];
  vendors: Vendor[];
  clients: Client[];
  currency: string;
  watchedExpectedAmount?: number;
  watchedActualAmount?: number;
  difference?: number;
}

export function StockForm({
  control,
  errors,
  watch,
  setValue,
  isDatePickerOpen,
  setIsDatePickerOpen,
  showStockContact,
  setShowStockContact,
  isNewStockItem,
  setIsNewStockItem,
  stockItems,
  banks,
  vendors,
  clients,
  currency,
  watchedExpectedAmount,
  watchedActualAmount,
  difference = 0
}: StockFormProps) {
  const stockType = watch('stockType');
  const stockPaymentMethod = watch('paymentMethod');
  const contactId = watch('contact_id');
  const isExpense = stockType === 'purchase';

  return (
    <div className="space-y-4">
      <DateField 
        control={control} 
        errors={errors} 
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
      />

      <div>
        <Label>Transaction Type</Label>
        <Controller
          name="stockType"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="purchase" id="purchase" />
                <Label htmlFor="purchase">Purchase</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sale" id="sale" />
                <Label htmlFor="sale">Sale</Label>
              </div>
            </RadioGroup>
          )}
        />
        {errors.stockType && <p className="text-sm text-destructive">{errors.stockType.message as string}</p>}
      </div>

      <div>
        <Label>Stock Item</Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Controller
              name="stockItemName"
              control={control}
              render={({ field }) => (
                isNewStockItem ? (
                  <Input
                    {...field}
                    placeholder="Enter new stock item name"
                  />
                ) : (
                  <ResponsiveSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select stock item"
                    items={[
                      ...stockItems.map(item => ({
                        value: item.name,
                        label: `${item.name} (${item.weight} kg available)`
                      }))
                    ]}
                  />
                )
              )}
            />
          </div>
          <Button
            type="button"
            variant={isNewStockItem ? "default" : "outline"}
            onClick={() => setIsNewStockItem(!isNewStockItem)}
          >
            {isNewStockItem ? <Plus className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
          </Button>
        </div>
        {errors.stockItemName && <p className="text-sm text-destructive">{errors.stockItemName.message as string}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Weight (kg)</Label>
          <Controller
            name="weight"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                placeholder="Enter weight"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          />
          {errors.weight && <p className="text-sm text-destructive">{errors.weight.message as string}</p>}
        </div>

        <div>
          <Label>Price per kg ({currency})</Label>
          <Controller
            name="pricePerKg"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                placeholder="Enter price per kg"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          />
          {errors.pricePerKg && <p className="text-sm text-destructive">{errors.pricePerKg.message as string}</p>}
        </div>
      </div>

      <div>
        <Label>Payment Method</Label>
        <Controller
          name="paymentMethod"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash">Cash</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bank" id="bank" />
                <Label htmlFor="bank">Bank</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id="credit" />
                <Label htmlFor="credit">Credit</Label>
              </div>
            </RadioGroup>
          )}
        />
        {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message as string}</p>}
      </div>

      {stockPaymentMethod === 'bank' && (
        <BankField 
          control={control}
          errors={errors}
          banks={banks}
        />
      )}

      {stockPaymentMethod === 'credit' && (
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
        </>
      )}

      {stockPaymentMethod !== 'credit' && (
        <>
          <div className="flex items-center space-x-2 p-3 bg-muted/20 rounded-md">
            <Checkbox
              id="showStockContact"
              checked={showStockContact}
              onCheckedChange={setShowStockContact}
            />
            <Label htmlFor="showStockContact" className="cursor-pointer">
              Add Contact (Optional)
            </Label>
          </div>

          {showStockContact && (
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
            </>
          )}
        </>
      )}

      <div>
        <Label>Description (Optional)</Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Enter description"
            />
          )}
        />
      </div>

      <AdvancedAmountFields 
        control={control}
        errors={errors}
        watchedExpectedAmount={watchedExpectedAmount}
        watchedActualAmount={watchedActualAmount}
        difference={difference}
        currency={currency}
      />

      {stockPaymentMethod === 'credit' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Credit Transaction</AlertTitle>
          <AlertDescription>
            This will create an {isExpense ? 'Accounts Payable' : 'Accounts Receivable'} entry with the selected contact.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}