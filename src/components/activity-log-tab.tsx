
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ActivityLog } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export function ActivityLogTab() {
  const logs = useLiveQuery(
    () => db.activity_log.orderBy('created_at').reverse().toArray(),
    []
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>A record of important actions performed in the application.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
         <div className="border rounded-lg overflow-hidden">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {logs === undefined ? (
                    <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                ) : logs.length > 0 ? (
                logs.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{format(parseISO(log.created_at), "dd-MM-yyyy 'at' HH:mm:ss")}</TableCell>
                        <TableCell>{log.username || 'System'}</TableCell>
                        <TableCell>{log.description}</TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow><TableCell colSpan={3} className="text-center h-24">No activity logs found.</TableCell></TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
