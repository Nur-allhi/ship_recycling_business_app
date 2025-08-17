
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { readData } from '@/app/actions';
import type { ActivityLog } from '@/lib/types';
import { format, parseISO } from 'date-fns';

export function ActivityLogTab() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedLogs = await readData({ tableName: 'activity_log' });
      // Supabase might return null, so ensure we have an array
      setLogs(fetchedLogs?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error fetching activity logs', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>A record of important actions performed in the application.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4"/>}
              </Button>
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
                {isLoading ? (
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

    