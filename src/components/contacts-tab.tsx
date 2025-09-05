
"use client";

import { useState, useMemo, useRef } from "react";
import { useAppContext } from "@/app/context/app-context";
import { useAppActions } from "@/app/context/app-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { FileClock, Trash2, Plus } from "lucide-react";
import { ContactHistoryDialog } from "./contact-history-dialog";
import type { Contact } from "@/lib/types";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { Separator } from "./ui/separator";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";

export function ContactsTab() {
    const { contacts, ledgerTransactions, user } = useAppContext();
    const { addContact, deleteContact } = useAppActions();
    
    const [historyState, setHistoryState] = useState<{isOpen: boolean, contact: Contact | null}>({isOpen: false, contact: null});
    const [deleteState, setDeleteState] = useState<{isOpen: boolean, contact: Contact | null}>({isOpen: false, contact: null});
    const [filter, setFilter] = useState<'all' | 'vendor' | 'client'>('all');
    
    const newContactNameRef = useRef<HTMLInputElement>(null);
    const [newContactType, setNewContactType] = useState<'vendor' | 'client'>('vendor');
    const isAdmin = user?.role === 'admin';

    const contactTransactionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        contacts.forEach(c => counts[c.id] = 0);
        ledgerTransactions.forEach(tx => {
            if (tx.contact_id && counts[tx.contact_id] !== undefined) {
                counts[tx.contact_id]++;
            }
        });
        return counts;
    }, [contacts, ledgerTransactions]);

    const handleAddContact = () => {
        const name = newContactNameRef.current?.value.trim();
        if (name) {
            addContact(name, newContactType);
            if (newContactNameRef.current) newContactNameRef.current.value = "";
            toast.success("Contact added successfully");
        } else {
            toast.error("Contact name cannot be empty");
        }
    };
    
    const handleDeleteClick = (contact: Contact) => {
        setDeleteState({ isOpen: true, contact: contact });
    };

    const confirmDeletion = () => {
        if (deleteState.contact) {
            deleteContact(deleteState.contact.id);
            toast.success(`Contact "${deleteState.contact.name}" deleted.`);
            setDeleteState({ isOpen: false, contact: null });
        }
    };

    const handleViewHistory = (contact: Contact) => {
        setHistoryState({ isOpen: true, contact: contact });
    }

    const filteredContacts = useMemo(() => {
        if (filter === 'all') return contacts;
        return contacts.filter(c => c.type === filter || c.type === 'both');
    }, [contacts, filter]);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Contact Management</CardTitle>
                    <CardDescription>Manage your list of vendors and clients.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isAdmin && (
                        <>
                            <div>
                                <h3 className="font-semibold mb-2">Add New Contact</h3>
                                <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg">
                                   <div className="flex-grow space-y-2">
                                        <Label htmlFor="new-contact-name">Contact Name</Label>
                                        <Input id="new-contact-name" placeholder="Enter name" ref={newContactNameRef} />
                                   </div>
                                   <div className="space-y-2">
                                       <Label>Contact Type</Label>
                                        <RadioGroup onValueChange={(v) => setNewContactType(v as any)} defaultValue={newContactType} className="flex pt-2 gap-4">
                                            <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="vendor" /> Vendor</Label>
                                            <Label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="client" /> Client</Label>
                                        </RadioGroup>
                                   </div>
                                    <Button onClick={handleAddContact} className="mt-auto"><Plus className="mr-2 h-4 w-4" /> Add</Button>
                                </div>
                            </div>
                            <Separator />
                        </>
                    )}
                    
                    <div className="space-y-4">
                        <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
                            <TabsList className="grid grid-cols-3 w-full sm:w-auto">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="vendor">Vendors</TabsTrigger>
                                <TabsTrigger value="client">Clients</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredContacts.length > 0 ? (
                                        filteredContacts.map(contact => (
                                            <TableRow key={contact.id}>
                                                <TableCell className="font-medium">{contact.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={contact.type === 'vendor' ? 'secondary' : 'outline'} className="capitalize">{contact.type}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleViewHistory(contact)}>
                                                        <FileClock className="mr-2 h-4 w-4" />
                                                        History
                                                    </Button>
                                                    {isAdmin && (
                                                        <Button 
                                                            variant="destructive" 
                                                            size="icon" 
                                                            onClick={() => handleDeleteClick(contact)}
                                                            disabled={contactTransactionCounts[contact.id] > 0}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">No contacts found for this filter.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>
            {historyState.contact && (
                <ContactHistoryDialog 
                    isOpen={historyState.isOpen}
                    setIsOpen={(isOpen) => setHistoryState({ isOpen, contact: isOpen ? historyState.contact : null })}
                    contact={historyState.contact}
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
