
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { db, bulkPut, clearAllData } from '@/lib/db';
import * as server from '@/lib/actions';
import { getSession as getSessionFromCookie, login as serverLogin, logout as serverLogout } from '@/app/auth/actions';
import type { User, Category } from '@/lib/types';
import { useBalanceCalculator } from './useBalanceCalculator';
import { useDataSyncer } from './useDataSyncer';


export function useSessionManager() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

    const { updateBalances } = useBalanceCalculator();
    // This is a temporary solution to avoid circular dependency.
    // In a larger app, a dedicated sync service/event bus would be better.
    // const { processSyncQueue } = useDataSyncer(); 

    const logout = useCallback(async () => {
        setIsLoggingOut(true);
        try {
            await serverLogout();
            await db.app_state.update(1, { user: null });
            await clearAllData();
            setUser(null);
            toast.success("Logged out successfully!");
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        } catch (error) {
            console.error("Logout failed:", error);
            toast.error("Logout Failed", { description: "Could not properly log you out. Please try clearing your cookies and refreshing the page." });
            window.location.href = '/login';
        } finally {
            setIsLoggingOut(false);
        }
    }, [setUser]);

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
    
    // We need to pass processSyncQueue here to avoid circular dependencies
    const reloadData = useCallback(async (processSyncQueue: Function, options?: { force?: boolean, needsInitialBalance?: boolean }) => {
        setIsLoading(true);
        try {
            const session = await getSessionFromCookie();
            if (!session) {
                setIsLoading(false);
                setUser(null);
                await db.app_state.update(1, { user: null });
                return;
            }

            setUser(session);

            const localUser = await db.app_state.get(1);
            if (!localUser || !localUser.user || localUser.user.id !== session.id || options?.force) {
                await db.app_state.put({
                    id: 1, user: session, fontSize: 'base', currency: 'BDT',
                    wastagePercentage: 0, showStockValue: false, lastSync: null
                });
                
                const [categoriesData, contactsData, banksData, cashTxs, bankTxs, stockTxs, ledgerData, installmentsData, snapshotsData, initialStockData, loansData, loanPaymentsData] = await Promise.all([
                    server.readData({ tableName: 'categories', select: '*' }),
                    server.readData({ tableName: 'contacts', select: '*' }),
                    server.readData({ tableName: 'banks', select: '*' }),
                    server.readData({ tableName: 'cash_transactions', select: '*' }),
                    server.readData({ tableName: 'bank_transactions', select: '*' }),
                    server.readData({ tableName: 'stock_transactions', select: '*' }),
                    server.readData({ tableName: 'ap_ar_transactions', select: '*' }),
                    server.readData({ tableName: 'payment_installments', select: '*' }),
                    server.readData({ tableName: 'monthly_snapshots', select: '*' }),
                    server.readData({ tableName: 'initial_stock', select: '*' }),
                    server.readData({ tableName: 'loans', select: '*' }),
                    server.readData({ tableName: 'loan_payments', select: '*' }),
                ]);
                
                const ledgerTxsWithInstallments = (ledgerData || []).map((tx: any) => ({
                    ...tx,
                    installments: (installmentsData || []).filter((ins: any) => ins.ap_ar_transaction_id === tx.id)
                }));
                
                const essentialCategories = [
                    { name: 'A/R Settlement', type: 'cash', direction: 'credit', is_deletable: false },
                    { name: 'A/P Settlement', type: 'cash', direction: 'debit', is_deletable: false },
                    { name: 'A/R Settlement', type: 'bank', direction: 'credit', is_deletable: false },
                    { name: 'A/P Settlement', type: 'bank', direction: 'debit', is_deletable: false },
                    { name: 'Stock Purchase', type: 'cash', direction: 'debit', is_deletable: false },
                    { name: 'Stock Sale', type: 'cash', direction: 'credit', is_deletable: false },
                    { name: 'Stock Purchase', type: 'bank', direction: 'debit', is_deletable: false },
                    { name: 'Stock Sale', type: 'bank', direction: 'credit', is_deletable: false },
                    { name: 'Initial Balance', type: 'cash', direction: 'credit', is_deletable: false },
                    { name: 'Initial Balance', type: 'bank', direction: 'credit', is_deletable: false },
                    { name: 'Funds Transfer', type: 'cash', direction: null, is_deletable: false },
                    { name: 'Funds Transfer', type: 'bank', direction: null, is_deletable: false },
                    { name: 'Advance Payment', type: 'cash', direction: 'debit', is_deletable: false },
                    { name: 'Advance Received', type: 'cash', direction: 'credit', is_deletable: false },
                    { name: 'Advance Payment', type: 'bank', direction: 'debit', is_deletable: false },
                    { name: 'Advance Received', type: 'bank', direction: 'credit', is_deletable: false },
                ];

                for (const cat of essentialCategories) {
                    const categories = Array.isArray(categoriesData) ? (categoriesData as unknown as Category[]) : [];
                    const exists = categories.some((c) => c.name === cat.name && c.type === cat.type);
                    if (!exists) {
                        const newCat = await server.appendData({ tableName: 'categories', data: cat, select: '*' });
                        if (newCat && Array.isArray(categoriesData)) {
                            ((categoriesData as unknown) as Category[]).push((newCat as unknown) as Category);
                        }
                    }
                }

                await db.transaction('rw', db.tables, async () => {
                    await db.app_state.put({
                        id: 1, user: session, fontSize: 'base', currency: 'BDT',
                        wastagePercentage: 0, showStockValue: false, lastSync: null
                    });
                    await bulkPut('categories', categoriesData); await bulkPut('contacts', contactsData);
                    await bulkPut('banks', banksData);
                    await bulkPut('cash_transactions', cashTxs); await bulkPut('bank_transactions', bankTxs);
                    await bulkPut('stock_transactions', stockTxs); await bulkPut('ap_ar_transactions', ledgerTxsWithInstallments);
                    await bulkPut('payment_installments', installmentsData);
                    await bulkPut('monthly_snapshots', snapshotsData); await bulkPut('initial_stock', initialStockData);
                    await bulkPut('loans', loansData); await bulkPut('loan_payments', loanPaymentsData);
                    await db.app_state.update(1, { lastSync: new Date().toISOString() });
                });
            }

            await updateBalances();
            processSyncQueue();

        } catch (error: any) {
            handleApiError(error);
        } finally {
            setIsLoading(false);
        }
    }, [handleApiError, updateBalances, setUser]);

    const login = useCallback(async (credentials: Parameters<typeof serverLogin>[0]) => {
        setIsAuthenticating(true);
        try {
            const result = await serverLogin(credentials);
            if (result.success && result.session) {
                await db.app_state.update(1, { user: result.session });
                setUser(result.session);
                // The reloadData here is problematic due to circular dependency.
                // It should be called from the AppProvider after login.
                toast.success("Login Successful", { description: "Welcome back!" });
                router.push('/');
            }
            return result;
        } catch (error: any) {
            toast.error('Login Failed', { description: error.message });
            throw error;
        } finally {
            setIsAuthenticating(false);
        }
    }, [setUser, router]);

    useEffect(() => {
        const checkSessionAndLoad = async () => {
            const session = await getSessionFromCookie();
            setUser(session);
            const localUser = await db.app_state.get(1);
            if (session) {
                if (localUser?.user?.id === session.id) {
                    setIsLoading(false);
                    await updateBalances();
                } else {
                    // Force a full reload, but can't call reloadData directly.
                    // This will be handled by the AppProvider.
                }
            } else {
                setIsLoading(false);
            }
            setIsInitialLoadComplete(true);
        };
        checkSessionAndLoad();
    }, [updateBalances]);

    return {
        user,
        setUser,
        isLoading,
        isAuthenticating,
        isLoggingOut,
        isOnline,
        isInitialLoadComplete,
        login,
        logout,
        reloadData,
        handleApiError,
        setIsOnline,
    };
}

    