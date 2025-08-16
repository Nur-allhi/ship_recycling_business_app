
"use client";

import { useState } from "react";
import { useAppContext } from "@/app/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { FileClock } from "lucide-react";
import { ContactHistoryDialog } from "./contact-history-dialog";
import type { Vendor } from "@/lib/types";

export function VendorList() {
    const { vendors } = useAppContext();
    const [historyState, setHistoryState] = useState<{isOpen: boolean, contact: Vendor | null}>({isOpen: false, contact: null});

    const handleViewHistory = (vendor: Vendor) => {
        setHistoryState({ isOpen: true, contact: vendor });
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Vendors</CardTitle>
                    <CardDescription>Manage your list of vendors. Add new vendors when creating a payable transaction.</CardDescription>
                </CardHeader>
                <CardContent>
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
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => handleViewHistory(vendor)}>
                                                <FileClock className="mr-2 h-4 w-4" />
                                                View History
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
        </>
    );
}

    