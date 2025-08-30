import React from 'react';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { CalendarIcon, Settings2, Link, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveSelect } from '@/components/ui/responsive-select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Category, Bank, Vendor, Client } from '@/lib/types';

interface SharedFieldsProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  showAdvancedFields: boolean;
  setShowAdvancedFields: (show: boolean) => void;
  watchedAmount?: number;
  watchedExpectedAmount?: number;
  watchedActualAmount?: number;
  difference?: number;
  currency: string;
}

export function DateField({ control, errors, isDatePickerOpen, setIsDatePickerOpen }: Pick<SharedFieldsProps, 'control' | 'errors' | 'isDatePickerOpen' | 'setIsDatePickerOpen'>) {
  return (
    <div>
      <Label>Date</Label>
      <Controller
        name="date"
        control={control}
        render={({ field }) => (
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
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
                onSelect={(date) => {
                  field.onChange(date);
                  setIsDatePickerOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}
      />
      {errors.date && <p className="text-sm text-destructive">{errors.date.message as string}</p>}
    </div>
  );
}

export function AmountField({ control, errors, currency }: Pick<SharedFieldsProps, 'control' | 'errors' | 'currency'>) {
  return (
    <div>
      <Label>Amount ({currency})</Label>
      <Controller
        name="amount"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            type="number"
            step="0.01"
            placeholder="Enter amount"
            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
          />
        )}
      />
      {errors.amount && <p className="text-sm text-destructive">{errors.amount.message as string}</p>}
    </div>
  );
}

export function DescriptionField({ control, errors }: Pick<SharedFieldsProps, 'control' | 'errors'>) {
  return (
    <div>
      <Label>Description</Label>
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
      {errors.description && <p className="text-sm text-destructive">{errors.description.message as string}</p>}
    </div>
  );
}

export function CategoryField({ 
  control, 
  errors, 
  categories, 
  transactionType 
}: Pick<SharedFieldsProps, 'control' | 'errors'> & { 
  categories: Category[]; 
  transactionType: string; 
}) {
  return (
    <div>
      <Label>Category</Label>
      <Controller
        name="category"
        control={control}
        render={({ field }) => (
          <ResponsiveSelect
            value={field.value}
            onValueChange={field.onChange}
            placeholder="Select category"
            items={categories.map(cat => ({
              value: cat.name,
              label: cat.name
            }))}
          />
        )}
      />
      {errors.category && <p className="text-sm text-destructive">{errors.category.message as string}</p>}
    </div>
  );
}

export function BankField({ 
  control, 
  errors, 
  banks 
}: Pick<SharedFieldsProps, 'control' | 'errors'> & { 
  banks: Bank[]; 
}) {
  return (
    <div>
      <Label>Bank Account</Label>
      <Controller
        name="bank_id"
        control={control}
        render={({ field }) => (
          <ResponsiveSelect
            value={field.value}
            onValueChange={field.onChange}
            placeholder="Select bank account"
            items={banks.map(bank => ({
              value: bank.id.toString(),
              label: bank.name
            }))}
          />
        )}
      />
      {errors.bank_id && <p className="text-sm text-destructive">{errors.bank_id.message as string}</p>}
    </div>
  );
}

export function ContactField({ 
  control, 
  errors, 
  vendors, 
  clients, 
  isExpense 
}: Pick<SharedFieldsProps, 'control' | 'errors'> & { 
  vendors: Vendor[]; 
  clients: Client[]; 
  isExpense: boolean; 
}) {
  const contacts = isExpense ? vendors : clients;
  const contactType = isExpense ? 'vendor' : 'client';
  
  return (
    <div>
      <Label>{isExpense ? 'Vendor' : 'Client'} (Optional)</Label>
      <Controller
        name="contact_id"
        control={control}
        render={({ field }) => (
          <ResponsiveSelect
            value={field.value}
            onValueChange={field.onChange}
            placeholder={`Select ${contactType} or leave empty`}
            items={[
              ...contacts.map(contact => ({
                value: contact.id.toString(),
                label: contact.name
              })),
              { value: 'new', label: `+ Add New ${isExpense ? 'Vendor' : 'Client'}` }
            ]}
          />
        )}
      />
      {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message as string}</p>}
    </div>
  );
}

export function NewContactField({ control, errors }: Pick<SharedFieldsProps, 'control' | 'errors'>) {
  return (
    <div>
      <Label>New Contact Name</Label>
      <Controller
        name="newContact"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            placeholder="Enter new contact name"
          />
        )}
      />
      {errors.newContact && <p className="text-sm text-destructive">{errors.newContact.message as string}</p>}
    </div>
  );
}

export function AdvancedFieldsToggle({ 
  showAdvancedFields, 
  setShowAdvancedFields 
}: Pick<SharedFieldsProps, 'showAdvancedFields' | 'setShowAdvancedFields'>) {
  return (
    <div className="flex items-center space-x-2 p-3 bg-muted/20 rounded-md">
      <Checkbox
        id="showAdvanced"
        checked={showAdvancedFields}
        onCheckedChange={setShowAdvancedFields}
      />
      <Label htmlFor="showAdvanced" className="flex items-center gap-2 cursor-pointer">
        <Settings2 className="h-4 w-4" />
        Show Advanced Fields (Expected vs Actual Amount)
      </Label>
    </div>
  );
}

export function AdvancedAmountFields({ 
  control, 
  errors, 
  watchedExpectedAmount, 
  watchedActualAmount, 
  difference = 0, 
  currency 
}: Pick<SharedFieldsProps, 'control' | 'errors' | 'watchedExpectedAmount' | 'watchedActualAmount' | 'difference' | 'currency'>) {
  return (
    <div className="space-y-4 p-4 bg-muted/10 rounded-md">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Expected Amount ({currency})</Label>
          <Controller
            name="expected_amount"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                placeholder="Expected amount"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          />
          {errors.expected_amount && <p className="text-sm text-destructive">{errors.expected_amount.message as string}</p>}
        </div>
        
        <div>
          <Label>Actual Amount ({currency})</Label>
          <Controller
            name="actual_amount"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                placeholder="Actual amount"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          />
          {errors.actual_amount && <p className="text-sm text-destructive">{errors.actual_amount.message as string}</p>}
        </div>
      </div>
      
      {difference !== 0 && (
        <>
          <Alert className={difference > 0 ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
            <Link className="h-4 w-4" />
            <AlertTitle>Amount Discrepancy Detected</AlertTitle>
            <AlertDescription>
              Difference: <strong>{difference > 0 ? '+' : ''}{difference.toFixed(2)} {currency}</strong>
              {difference > 0 ? ' (Extra received)' : ' (Short received)'}
            </AlertDescription>
          </Alert>
          
          <div>
            <Label>Reason for Difference</Label>
            <Controller
              name="difference_reason"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Explain the reason for the difference"
                />
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}