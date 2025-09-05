
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
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

    const logout = useCallback(async () => {
        setIsLoggingOut(true);
        try {
            await serverLogout();
            await db.app_state.update(1, { user: null });
            await clearAllData();
            setUser(null);
            toast.success("Logged out successfully!");
            // Full page reload to ensure all state is cleared
            window.location.href = '/login';
        } catch (error) {
            console.error("Logout failed:", error);
            toast.error("Logout Failed", { description: "Could not properly log you out. Please try clearing your cookies and refreshing the page." });
            window.location.href = '/login';
        } finally {
            setIsLoggingOut(false);
        }
    }, []);

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
                setUser(result.session);
                toast.success("Login Successful", { description: "Welcome back!" });
                 // Full page reload to trigger a full data fetch in AppContext
                window.location.href = '/';
            }
            return result;
        } catch (error: any) {
            toast.error('Login Failed', { description: error.message });
            throw error;
        } finally {
            setIsAuthenticating(false);
        }
    }, []);


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
