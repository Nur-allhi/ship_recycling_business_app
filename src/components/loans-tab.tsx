"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LoansPayableList } from './loans-payable-list';
import { LoansReceivableList } from './loans-receivable-list';

export function LoansTab() {
    return (
        <Tabs defaultValue="payable" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payable">Loans Payable</TabsTrigger>
                <TabsTrigger value="receivable">Loans Receivable</TabsTrigger>
            </TabsList>
            <TabsContent value="payable" className="mt-4">
                <LoansPayableList />
            </TabsContent>
            <TabsContent value="receivable" className="mt-4">
                 <LoansReceivableList />
            </TabsContent>
        </Tabs>
    );
}
