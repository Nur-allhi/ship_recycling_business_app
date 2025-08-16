
"use client";

import { useState } from "react";
import { useAppContext } from "@/app/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { FileClock } from "lucide-react";
import { ContactHistoryDialog } from "./contact-history-dialog";
import type { Client } from "@/lib/types";

export function ClientList() {
    const { clients } = useAppContext();
    const [historyState, setHistoryState] = useState<{isOpen: boolean, contact: Client | null}>({isOpen: false, contact: null});

    const handleViewHistory = (client: Client) => {
        setHistoryState({ isOpen: true, contact: client });
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Clients</CardTitle>
                    <CardDescription>Manage your list of clients. Add new clients when creating a receivable transaction.</CardDescription>
                </CardHeader>
                <CardContent>
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
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => handleViewHistory(client)}>
                                                <FileClock className="mr-2 h-4 w-4" />
                                                View History
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
        </>
    );
}
