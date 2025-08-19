
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { login, hasUsers } from '@/app/actions';
import { Loader2 } from 'lucide-react';
import Logo from './logo';
import { Checkbox } from './ui/checkbox';

const formSchema = z.object({
  username: z.string().email("Username must be a valid email address."),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [doesAnyUserExist, setDoesAnyUserExist] = useState(true);

  useEffect(() => {
    const checkUsers = async () => {
        try {
            const usersExist = await hasUsers();
            setDoesAnyUserExist(usersExist);
        } catch (error: any) {
            console.error("Failed to check for users:", error);
            // Default to true to show the regular login button on error
            setDoesAnyUserExist(true);
        }
    };
    checkUsers();
  }, []);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        username: '',
        password: '',
        rememberMe: false
    }
  });

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setValue('username', savedUsername);
      setValue('rememberMe', true);
    }
  }, [setValue]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await login(data);

      if (data.rememberMe) {
          localStorage.setItem('rememberedUsername', data.username);
      } else {
          localStorage.removeItem('rememberedUsername');
      }

      toast.success("Login Successful", { description: "Welcome!" });
      // Clear cache for the new user then force a hard reload
      localStorage.removeItem('ha-mim-iron-mart-cache');
      window.location.href = '/'; 
    } catch (error: any) {
      toast.error(
        'Login Failed',
        {description: error.message,}
      );
      setIsLoading(false);
    }
  };
  
  const buttonText = doesAnyUserExist ? 'Login' : 'Create First Admin Account';

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
            <Logo className="h-16 w-16 text-primary" />
        </div>
        <CardTitle className="text-2xl">Login to your account</CardTitle>
        <CardDescription>Enter your email and password below.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
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
           <div className="flex items-center space-x-2">
            <Checkbox id="rememberMe" {...register('rememberMe')} />
            <label
                htmlFor="rememberMe"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
                Remember me
            </label>
           </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {buttonText}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
