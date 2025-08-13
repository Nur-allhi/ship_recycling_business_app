
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertTriangle, BookOpenCheck } from "lucide-react";
import { initializeSheets } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '../store';

export default function SetupPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();
    const { setNeedsSetup, reloadData } = useAppContext();

    const handleInitialize = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await initializeSheets();
            if (result.success) {
                setIsSuccess(true);
                toast({
                    title: "Sheets Initialized!",
                    description: "Your Google Sheets are now set up with the correct headers.",
                });
            } else {
                throw new Error(result.error || "An unknown error occurred during setup.");
            }
        } catch (err: any) {
            setError(err.message);
            toast({
                variant: 'destructive',
                title: "Initialization Failed",
                description: err.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = async () => {
        setNeedsSetup(false);
        await reloadData();
        router.push('/');
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Card className="w-full max-w-lg shadow-2xl animate-fade-in">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <BookOpenCheck className="w-12 h-12 text-primary" />
                    </div>
                    <CardTitle className="text-center text-2xl">One-Time Setup</CardTitle>
                    <CardDescription className="text-center">
                        Let's prepare your Google Sheet to work as a database for your app.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p>This action will create the necessary headers in your Google Sheet for the following tabs: <br /> <span className="font-semibold">Cash, Bank, Stock Transactions,</span> and <span className="font-semibold">Initial Stock</span>.</p>
                    <p className="text-sm text-muted-foreground">Please ensure you have given editor access to your service account email for this Google Sheet.</p>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    {!isSuccess ? (
                         <Button onClick={handleInitialize} disabled={isLoading} className="w-full">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLoading ? 'Initializing...' : 'Initialize Sheets'}
                        </Button>
                    ) : (
                        <Button onClick={handleContinue} className="w-full bg-green-600 hover:bg-green-700">
                             <CheckCircle className="mr-2 h-4 w-4" />
                            Setup Complete! Continue to App
                        </Button>
                    )}
                   
                    {error && (
                        <div className="text-sm text-destructive flex items-center gap-2">
                           <AlertTriangle className="h-4 w-4" /> 
                           <span>{error}</span>
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
