
"use client";

import { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress";
import Logo from './logo';

export function AppLoading({ message }: { message?: string }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // This is a fake progress animation for better UX.
        // The actual loading happens in the AppProvider.
        const timer = setTimeout(() => setProgress(30), 100);
        const timer2 = setTimeout(() => setProgress(70), 500);
        const timer3 = setTimeout(() => setProgress(90), 1200);
        
        return () => {
            clearTimeout(timer);
            clearTimeout(timer2);
            clearTimeout(timer3);
        }
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">
                <div className="flex items-center gap-4">
                    <Logo className="h-12 w-12 text-primary" />
                    <h1 className="text-2xl font-bold text-primary">Ha-Mim Iron Mart</h1>
                </div>
                <Progress value={progress} className="w-full h-2" />
                <p className="text-muted-foreground animate-pulse text-center">
                    {message || "Loading your ledger..."}
                </p>
            </div>
        </div>
    );
}
