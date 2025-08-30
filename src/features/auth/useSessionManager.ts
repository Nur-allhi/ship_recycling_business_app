import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { User } from '@/lib/types';
import { getSession, login as serverLogin, logout as serverLogout } from '@/app/auth/actions';
import { db, clearAllData as clearLocalDb } from '@/lib/db';

export interface SessionManagerState {
  user: User | null;
  isLoading: boolean;
}

export interface SessionManagerActions {
  login: (credentials: Parameters<typeof serverLogin>[0]) => Promise<any>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export interface SessionManagerReturn extends SessionManagerState, SessionManagerActions {}

export function useSessionManager(
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>
): SessionManagerReturn {
  const router = useRouter();
  const pathname = usePathname();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await serverLogout();
      await clearLocalDb();
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if server call fails
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const login = useCallback(async (credentials: Parameters<typeof serverLogin>[0]) => {
    try {
      const result = await serverLogin(credentials);
      if (result.success && result.session) {
        await db.app_state.update(1, { user: result.session });
        setUser(result.session);
        await reloadData({ force: true, needsInitialBalance: result.needsInitialBalance });
      }
      return result;
    } catch (error: any) {
      toast.error('Login Failed', { description: error.message });
      throw error;
    }
  }, [reloadData]);

  const checkSessionAndLoad = useCallback(async () => {
    try {
      const session = await getSession();
      setUser(session);
      
      if (session) {
        // Check if current user matches stored user
        const localUser = await db.app_state.get(1);
        if (localUser?.user?.id === session.id) {
          setIsLoading(false);
        } else {
          await reloadData({ force: true });
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Session check error:', error);
      setIsLoading(false);
    }
  }, [reloadData]);

  // Initialize session on mount
  useEffect(() => {
    checkSessionAndLoad();
  }, [checkSessionAndLoad]);

  // Handle routing based on authentication state
  useEffect(() => {
    if (isLoading) return;
    
    const onLoginPage = pathname === '/login';
    if (user && onLoginPage) {
      router.replace('/');
    } else if (!user && !onLoginPage) {
      router.replace('/login');
    }
  }, [user, isLoading, pathname, router]);

  return {
    user,
    isLoading,
    login,
    logout,
    setUser
  };
}