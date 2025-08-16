
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementTab } from "./user-management-tab";
import { VendorList } from "./vendor-list";
import { ClientList } from "./client-list";

export function ContactsTab() {
  return (
    <Tabs defaultValue="vendors" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="vendors">Vendors</TabsTrigger>
        <TabsTrigger value="clients">Clients</TabsTrigger>
        <TabsTrigger value="user_management">User Management</TabsTrigger>
      </TabsList>
      <TabsContent value="vendors">
        <VendorList />
      </TabsContent>
      <TabsContent value="clients">
        <ClientList />
      </TabsContent>
      <TabsContent value="user_management">
        <UserManagementTab />
      </TabsContent>
    </Tabs>
  );
}
