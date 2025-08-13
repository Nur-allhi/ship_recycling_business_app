
"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from "@/app/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function InitialBalanceDialog() {
  const { initialBalanceSet, setInitialBalances } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    // Open the dialog if the initial balance has not been set
    if (!initialBalanceSet) {
      setIsOpen(true);
    }
  }, [initialBalanceSet]);

  const handleSave = () => {
    const cashAmount = parseFloat(cash);
    const bankAmount = parseFloat(bank);

    if (isNaN(cashAmount) || isNaN(bankAmount) || cashAmount < 0 || bankAmount < 0) {
        toast({
            variant: "destructive",
            title: "Invalid Input",
            description: "Please enter valid, non-negative numbers for balances.",
        });
        return;
    }

    setInitialBalances(cashAmount, bankAmount);
    toast({
        title: "Balances Set",
        description: "Your initial cash and bank balances have been saved.",
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Initial Balances</DialogTitle>
          <DialogDescription>
            Enter your starting balances for cash and bank accounts. You can set initial stock from the Settings tab.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cash-balance" className="text-right">
              Cash
            </Label>
            <Input
              id="cash-balance"
              type="number"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 500.00"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bank-balance" className="text-right">
              Bank
            </Label>
            <Input
              id="bank-balance"
              type="number"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 10000.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save Balances</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    