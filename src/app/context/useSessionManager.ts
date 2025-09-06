
"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { db, clearAllData } from '@/lib/db';
import { login as serverLogin, logout as serverLogout } from '@/app/auth/actions';
import type { User } from '@/lib/types';

export function useSessionManager() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

    const logout = useCallback(async () => {
        setIsLoggingOut(true);
        toast.info("Logging you out and clearing data...");
        try {
            await serverLogout();
        } catch (error) {
            console.error("Server logout failed, proceeding with client-side cleanup:", error);
        } finally {
            await clearAllData(true); 
            setUser(null);
            setIsLoggingOut(false);
            router.replace('/login');
        }
    }, [router]);

    const handleApiError = useCallback((error: any) => {
        const isAuthError = error.message.includes('JWT') || error.message.includes('Unauthorized') || error.message.includes("SESSION_EXPIRED");
        if (isAuthError) {
            toast.error('Session Expired', { description: 'Your session has expired. Please log in again.' });
            logout();
        } else {
            console.error("API Error:", error);
            toast.error('An Error Occurred', { description: error.message || 'An unknown error occurred. Please try again.' });
        }
    }, [logout]);
    
    const login = useCallback(async (credentials: Parameters<typeof serverLogin>[0]) => {
        setIsAuthenticating(true);
        try {
            const result = await serverLogin(credentials);
            if (result.success && result.session) {
                toast.success("Login Successful", { description: "Welcome back!" });
                setIsInitialLoadComplete(false); // This will trigger a reload in the main context
                router.replace('/');
            }
            return result;
        } catch (error: any) {
            toast.error('Login Failed', { description: error.message });
            throw error;
        } finally {
            setIsAuthenticating(false);
        }
    }, [router]);


    return {
        user,
        setUser,
        isLoading,
        setIsLoading,
        isAuthenticating,
        isLoggingOut,
        isOnline,
        isInitialLoadComplete,
        setIsInitialLoadComplete,
        login,
        logout,
        handleApiError,
        setIsOnline,
    };
}
