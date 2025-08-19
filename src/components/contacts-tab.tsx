
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorList } from "./vendor-list";
import { ClientList } from "./client-list";

export function ContactsTab() {
  return (
    <Tabs defaultValue="vendors" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="vendors">Vendors</TabsTrigger>
        <TabsTrigger value="clients">Clients</TabsTrigger>
      </TabsList>
      <TabsContent value="vendors">
        <VendorList />
      </TabsContent>
      <TabsContent value="clients">
        <ClientList />
      </TabsContent>
    </Tabs>
  );
}
