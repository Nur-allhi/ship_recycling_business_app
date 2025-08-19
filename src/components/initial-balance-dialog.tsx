
"use client";

import { useRef } from 'react';
import { useAppContext } from '@/app/store';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Landmark, Wallet } from 'lucide-react';
import { Separator } from './ui/separator';

interface InitialBalanceDialogProps {
  isOpen: boolean;
}

export function InitialBalanceDialog({ isOpen }: InitialBalanceDialogProps) {
  const { setInitialBalances, banks } = useAppContext();
  const cashRef = useRef<HTMLInputElement>(null);
  const bankRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleSave = () => {
    const cash = parseFloat(cashRef.current?.value || '0');
    if (isNaN(cash) || cash < 0) {
      toast.error(
        'Invalid Input',
        {description: 'Please enter a valid, non-negative number for the cash balance.',}
      );
      return;
    }
    
    const bankTotals: Record<string, number> = {};
    for (const bank of banks) {
      const value = parseFloat(bankRefs.current[bank.id]?.value || '0');
      if (isNaN(value) || value < 0) {
        toast.error(
            'Invalid Input',
            {description: `Please enter a valid, non-negative number for ${bank.name}.`,}
        );
        return;
      }
      bankTotals[bank.id] = value;
    }
    
    setInitialBalances(cash, bankTotals);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Initial Balances</DialogTitle>
          <DialogDescription>
            Welcome! To get started, please set your initial balances. You can add initial stock from the Settings tab later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cash-balance" className="text-right">
              <Wallet className="h-5 w-5 inline-block" />
            </Label>
            <Input
              id="cash-balance"
              ref={cashRef}
              type="number"
              placeholder="Initial Cash"
              className="col-span-3"
              defaultValue="0"
            />
          </div>
          <Separator />
          {banks.map(bank => (
            <div key={bank.id} className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor={`bank-balance-${bank.id}`} className="text-right text-sm">
                {bank.name}
              </Label>
              <Input
                id={`bank-balance-${bank.id}`}
                ref={el => bankRefs.current[bank.id] = el}
                type="number"
                placeholder="Initial Bank Balance"
                className="col-span-3"
                defaultValue="0"
              />
            </div>
          ))}
          {banks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center col-span-4">
              No bank accounts found. You can add them in Settings {'>'} General.
            </p>
          )}

        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save and Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
