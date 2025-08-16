
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { appendData, readData, deleteData } from '@/app/actions';
import type { Vendor } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function VendorManagementTab() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const newVendorRef = useRef<HTMLInputElement>(null);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedVendors = await readData({ tableName: 'vendors' });
      setVendors(fetchedVendors);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error fetching vendors', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const onAddVendor = async () => {
    const name = newVendorRef.current?.value.trim();
    if (!name) {
        toast({ variant: 'destructive', title: 'Vendor name cannot be empty.' });
        return;
    }
    try {
      await appendData({ tableName: 'vendors', data: { name } });
      toast({ title: 'Vendor added successfully' });
      if(newVendorRef.current) newVendorRef.current.value = "";
      fetchVendors();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error adding vendor', description: error.message });
    }
  };
  
  const onDeleteVendor = async (vendorId: string) => {
    try {
        await deleteData({ tableName: 'vendors', id: vendorId });
        toast({ title: 'Vendor deleted successfully' });
        fetchVendors();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error deleting vendor', description: error.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Management</CardTitle>
        <CardDescription>Add, view, and remove your business vendors.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div>
            <h3 className="text-lg font-medium">Add New Vendor</h3>
            <div className="flex items-center gap-2 mt-4 p-4 border rounded-lg">
                <Input ref={newVendorRef} placeholder="e.g. National Steel Co."/>
                <Button onClick={onAddVendor}><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button>
            </div>
        </div>
        
        <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Your Vendors</h3>
              <Button variant="ghost" size="icon" onClick={fetchVendors} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4"/>}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={2} className="text-center h-24">Loading vendors...</TableCell></TableRow>
                    ) : vendors.length > 0 ? (
                    vendors.map((vendor) => (
                        <TableRow key={vendor.id}>
                            <TableCell>{vendor.name}</TableCell>
                            <TableCell className="text-right">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the vendor '{vendor.name}'. This action cannot be undone.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDeleteVendor(vendor.id)}>
                                            Delete Vendor
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow><TableCell colSpan={3} className="text-center h-24">No vendors found. Add one above.</TableCell></TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
