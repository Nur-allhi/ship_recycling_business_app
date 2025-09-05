
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { hasUsers } from '@/app/auth/actions';
import { Loader2 } from 'lucide-react';
import Logo from './logo';
import { Checkbox } from './ui/checkbox';
import { useAppContext } from '@/app/context/app-context';


const formSchema = z.object({
  username: z.string().email("Username must be a valid email address."),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function LoginForm() {
  const { login, isAuthenticating } = useAppContext();
  const [doesAnyUserExist, setDoesAnyUserExist] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const checkUsers = async () => {
        try {
            const usersExist = await hasUsers();
            setDoesAnyUserExist(usersExist);
        } catch (error: any) {
            console.error("Failed to check for users:", error);
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
        rememberMe: true
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
    try {
      const result = await login(data); // Await the login call from context
      
      if (data.rememberMe) {
          localStorage.setItem('rememberedUsername', data.username);
      } else {
          localStorage.removeItem('rememberedUsername');
      }

    } catch (error: any) {
      // Error handling is done in the context's login function, so no toast here.
      console.error("Login form submission error:", error);
    }
  };
  
  const buttonText = doesAnyUserExist ? 'Login' : 'Create First Admin Account';

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex flex-col items-center gap-2">
            <Logo className="h-16 w-16 text-primary" />
            <h1 className="text-2xl font-bold text-primary">Ha-Mim Iron Mart</h1>
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
                Remember Me
            </label>
           </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isAuthenticating}>
            {isAuthenticating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {buttonText}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
