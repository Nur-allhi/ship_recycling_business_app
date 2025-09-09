
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ActivityLog } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppContext } from '@/app/context/app-context';
import { useAppActions } from '@/app/context/app-actions';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';

export function ActivityLogTab() {
  const { user } = useAppContext();
  const { clearActivityLog } = useAppActions();
  const logs = useLiveQuery(
    () => db.activity_log.orderBy('created_at').reverse().toArray(),
    []
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  const handleClearLog = async () => {
    try {
        await clearActivityLog();
        toast.success("Activity Log Cleared");
    } catch(e: any) {
        toast.error("Failed to clear log", { description: e.message });
    } finally {
        setIsDeleteDialogOpen(false);
    }
  }
  
  const renderDesktopView = () => (
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
  );

  const renderMobileView = () => (
    <div className="space-y-4">
        {logs === undefined ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : logs.length > 0 ? (
            logs.map(log => (
                <Card key={log.id}>
                    <CardContent className="p-4 space-y-2">
                        <p className="font-medium">{log.description}</p>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{log.username || 'System'}</span>
                            <span className="font-mono text-xs">{format(parseISO(log.created_at), "dd-MM-yy HH:mm")}</span>
                        </div>
                    </CardContent>
                </Card>
            ))
        ) : (
             <div className="text-center text-muted-foreground py-12">No activity logs found.</div>
        )}
    </div>
  );

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>A record of important actions performed in the application.</CardDescription>
            </div>
            {isAdmin && logs && logs.length > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Log
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent>
         {isMobile ? renderMobileView() : renderDesktopView()}
      </CardContent>
    </Card>
     <DeleteConfirmationDialog 
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        onConfirm={handleClearLog}
        itemCount={logs?.length || 0}
        isPermanent={true}
      />
    </>
  );
}
