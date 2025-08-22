
"use client";

import { useState, useMemo, useRef } from "react";
import { useAppContext } from "@/app/context/app-context";
import { useAppActions } from "@/app/context/app-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { FileClock, Trash2, Plus } from "lucide-react";
import { ContactHistoryDialog } from "./contact-history-dialog";
import type { Vendor } from "@/lib/types";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { Separator } from "./ui/separator";

export function VendorList() {
    const { vendors, ledgerTransactions } = useAppContext();
    const { addVendor, deleteVendor } = useAppActions();
    const [historyState, setHistoryState] = useState<{isOpen: boolean, contact: Vendor | null}>({isOpen: false, contact: null});
    const [deleteState, setDeleteState] = useState<{isOpen: boolean, contact: Vendor | null}>({isOpen: false, contact: null});
    const newVendorRef = useRef<HTMLInputElement>(null);

    const vendorTransactionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        vendors.forEach(v => counts[v.id] = 0);
        ledgerTransactions.forEach(tx => {
            if (counts[tx.contact_id] !== undefined) {
                counts[tx.contact_id]++;
            }
        });
        return counts;
    }, [vendors, ledgerTransactions]);

    const handleAddVendor = () => {
        const name = newVendorRef.current?.value.trim();
        if (name) {
            addVendor(name);
            if (newVendorRef.current) newVendorRef.current.value = "";
            toast.success("Vendor added successfully");
        } else {
            toast.error("Vendor name cannot be empty");
        }
    };
    
    const handleDeleteClick = (vendor: Vendor) => {
        setDeleteState({ isOpen: true, contact: vendor });
    };

    const confirmDeletion = () => {
        if (deleteState.contact) {
            deleteVendor(deleteState.contact.id);
            toast.success(`Vendor "${deleteState.contact.name}" deleted.`);
            setDeleteState({ isOpen: false, contact: null });
        }
    };

    const handleViewHistory = (vendor: Vendor) => {
        setHistoryState({ isOpen: true, contact: vendor });
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Vendors</CardTitle>
                    <CardDescription>Manage your list of vendors.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-2">Add New Vendor</h3>
                        <div className="flex gap-2">
                            <Input placeholder="New vendor name" ref={newVendorRef} />
                            <Button size="icon" onClick={handleAddVendor}><Plus className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vendor Name</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vendors.length > 0 ? (
                                    vendors.map(vendor => (
                                        <TableRow key={vendor.id}>
                                            <TableCell className="font-medium">{vendor.name}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="sm" onClick={() => handleViewHistory(vendor)}>
                                                    <FileClock className="mr-2 h-4 w-4" />
                                                    History
                                                </Button>
                                                <Button 
                                                    variant="destructive" 
                                                    size="icon" 
                                                    onClick={() => handleDeleteClick(vendor)}
                                                    disabled={vendorTransactionCounts[vendor.id] > 0}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">No vendors found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            {historyState.contact && (
                <ContactHistoryDialog 
                    isOpen={historyState.isOpen}
                    setIsOpen={(isOpen) => setHistoryState({ isOpen, contact: isOpen ? historyState.contact : null })}
                    contact={historyState.contact}
                    contactType="vendor"
                />
            )}
            {deleteState.contact && (
                <DeleteConfirmationDialog 
                    isOpen={deleteState.isOpen}
                    setIsOpen={(isOpen) => setDeleteState({ isOpen, contact: isOpen ? deleteState.contact : null })}
                    onConfirm={confirmDeletion}
                    isPermanent={true}
                />
            )}
        </>
    );
}
