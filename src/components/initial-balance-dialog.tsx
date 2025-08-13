
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
import { useToast } from '@/hooks/use-toast';
import { Landmark, Wallet } from 'lucide-react';

interface InitialBalanceDialogProps {
  isOpen: boolean;
}

export function InitialBalanceDialog({ isOpen }: InitialBalanceDialogProps) {
  const { setInitialBalances } = useAppContext();
  const { toast } = useToast();
  const cashRef = useRef<HTMLInputElement>(null);
  const bankRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const cash = parseFloat(cashRef.current?.value || '0');
    const bank = parseFloat(bankRef.current?.value || '0');

    if (isNaN(cash) || isNaN(bank) || cash < 0 || bank < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please enter valid, non-negative numbers for balances.',
      });
      return;
    }
    
    setInitialBalances(cash, bank);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Initial Balances</DialogTitle>
          <DialogDescription>
            Welcome! To get started, please set your initial cash and bank balances. You can add initial stock from the Settings tab.
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bank-balance" className="text-right">
              <Landmark className="h-5 w-5 inline-block" />
            </Label>
            <Input
              id="bank-balance"
              ref={bankRef}
              type="number"
              placeholder="Initial Bank"
              className="col-span-3"
              defaultValue="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save and Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
