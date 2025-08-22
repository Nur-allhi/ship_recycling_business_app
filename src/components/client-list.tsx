
"use client";

import { useState, useMemo, useRef } from "react";
import { useAppContext } from "@/app/context/app-context";
import { useAppActions } from "@/app/context/app-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { FileClock, Trash2, Plus } from "lucide-react";
import { ContactHistoryDialog } from "./contact-history-dialog";
import type { Client } from "@/lib/types";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { Separator } from "./ui/separator";

export function ClientList() {
    const { clients, ledgerTransactions } = useAppContext();
    const { addClient, deleteClient } = useAppActions();
    const [historyState, setHistoryState] = useState<{isOpen: boolean, contact: Client | null}>({isOpen: false, contact: null});
    const [deleteState, setDeleteState] = useState<{isOpen: boolean, contact: Client | null}>({isOpen: false, contact: null});
    const newClientRef = useRef<HTMLInputElement>(null);

    const clientTransactionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        clients.forEach(c => counts[c.id] = 0);
        ledgerTransactions.forEach(tx => {
            if (counts[tx.contact_id] !== undefined) {
                counts[tx.contact_id]++;
            }
        });
        return counts;
    }, [clients, ledgerTransactions]);

    const handleAddClient = () => {
        const name = newClientRef.current?.value.trim();
        if (name) {
            addClient(name);
            if (newClientRef.current) newClientRef.current.value = "";
            toast.success("Client added successfully");
        } else {
            toast.error("Client name cannot be empty");
        }
    };
    
    const handleDeleteClick = (client: Client) => {
        setDeleteState({ isOpen: true, contact: client });
    };

    const confirmDeletion = () => {
        if (deleteState.contact) {
            deleteClient(deleteState.contact.id);
            toast.success(`Client "${deleteState.contact.name}" deleted.`);
            setDeleteState({ isOpen: false, contact: null });
        }
    };

    const handleViewHistory = (client: Client) => {
        setHistoryState({ isOpen: true, contact: client });
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Clients</CardTitle>
                    <CardDescription>Manage your list of clients.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-2">Add New Client</h3>
                        <div className="flex gap-2">
                            <Input placeholder="New client name" ref={newClientRef} />
                            <Button size="icon" onClick={handleAddClient}><Plus className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    <Separator />
                    
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client Name</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.length > 0 ? (
                                    clients.map(client => (
                                        <TableRow key={client.id}>
                                            <TableCell className="font-medium">{client.name}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="sm" onClick={() => handleViewHistory(client)}>
                                                    <FileClock className="mr-2 h-4 w-4" />
                                                    History
                                                </Button>
                                                <Button 
                                                    variant="destructive" 
                                                    size="icon" 
                                                    onClick={() => handleDeleteClick(client)}
                                                    disabled={clientTransactionCounts[client.id] > 0}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">No clients found.</TableCell>
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
                    contactType="client"
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
