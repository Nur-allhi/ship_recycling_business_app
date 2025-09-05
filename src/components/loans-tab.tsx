
"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function LoansTab() {
    return (
        <Tabs defaultValue="payable" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payable">Loans Payable</TabsTrigger>
                <TabsTrigger value="receivable">Loans Receivable</TabsTrigger>
            </TabsList>
            <TabsContent value="payable" className="mt-4">
                <p className="text-muted-foreground text-center py-8">
                    Content for loans you owe to others will be displayed here.
                </p>
            </TabsContent>
            <TabsContent value="receivable" className="mt-4">
                 <p className="text-muted-foreground text-center py-8">
                    Content for loans you have given to others will be displayed here.
                </p>
            </TabsContent>
        </Tabs>
    );
}
