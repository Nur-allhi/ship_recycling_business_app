"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveSelect } from '@/components/ui/responsive-select';
import { Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getUsers, addUser, deleteUser } from '@/lib/actions';
import type { User } from '@/lib/types';
import { useAppContext } from '@/app/context/app-context';
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
import { Separator } from './ui/separator';
import { Badge } from '@/components/ui/badge';

const newUserSchema = z.object({
  username: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(['admin', 'user'], { required_error: "Role is required." }),
});

type NewUserFormData = z.infer<typeof newUserSchema>;

export function UserManagementTab() {
  const { user: currentUser } = useAppContext();
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<NewUserFormData>({
    resolver: zodResolver(newUserSchema),
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    } catch (error: any) {
      toast.error('Error fetching users', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onAddUser = async (data: NewUserFormData) => {
    try {
      await addUser(data);
      toast.success('User added successfully');
      reset();
      fetchUsers();
    } catch (error: any) {
      toast.error('Error adding user', { description: error.message });
    }
  };
  
  const onDeleteUser = async (userId: string) => {
    try {
        await deleteUser(userId);
        toast.success('User deleted successfully');
        fetchUsers();
    } catch (error: any) {
        toast.error('Error deleting user', { description: error.message });
    }
  };

  const roleItems = useMemo(() => [
    { value: 'user', label: 'User' },
    { value: 'admin', label: 'Admin' }
  ], []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Add, view, and remove users from the system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div>
            <h3 className="text-lg font-medium">Add New User</h3>
            <form onSubmit={handleSubmit(onAddUser)} className="space-y-4 mt-4 p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username (Email)</Label>
                        <Input id="username" {...register('username')} />
                        {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" {...register('password')} />
                        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Role</Label>
                         <Controller
                            control={control}
                            name="role"
                            render={({ field }) => (
                                <ResponsiveSelect
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    title="Select a role"
                                    placeholder="Select a role"
                                    items={roleItems}
                                />
                            )}
                        />
                        {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
                    </div>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} 
                  Add User
                </Button>
            </form>
        </div>
        
        <Separator/>

        <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Existing Users</h3>
              <Button variant="ghost" size="icon" onClick={fetchUsers} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4"/>}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                    ) : users.length > 0 ? (
                    users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>{user.username}</TableCell>
                            <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                            <TableCell className="text-right">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            disabled={user.id === currentUser?.id}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the user '{user.username}'. This action cannot be undone.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDeleteUser(user.id)}>
                                            Delete User
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow><TableCell colSpan={3} className="text-center h-24">No users found.</TableCell></TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
