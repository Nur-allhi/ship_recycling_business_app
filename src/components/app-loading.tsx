"use client";

import { useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import Logo from './logo';
import { useAppContext } from '@/app/store';

export function AppLoading() {
    const { loadingProgress } = useAppContext();

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">
                <div className="flex items-center gap-4">
                    <Logo className="h-12 w-12 text-primary" />
                    <h1 className="text-2xl font-bold text-primary">Ha-Mim Iron Mart</h1>
                </div>
                <Progress value={loadingProgress} className="w-full h-2" />
                <p className="text-muted-foreground animate-pulse">Loading your ledger...</p>
            </div>
        </div>
    );
}
