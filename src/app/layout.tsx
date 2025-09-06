
"use client";

import './globals.css';
import { Toaster } from 'sonner';
import { AppProvider, useAppContext } from '@/app/context/app-context';
import LogoutOverlayWrapper from '@/components/logout-overlay-wrapper';
import { cn } from '@/lib/utils';
import { AppLoading } from '@/components/app-loading';

function LayoutContent({ children }: { children: React.ReactNode }) {
    const { fontSize, isLoading, isInitialLoadComplete } = useAppContext();

    const fontClasses = {
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-xl',
    };

    if (isLoading || !isInitialLoadComplete) {
        return (
            <div className={cn('antialiased', fontClasses[fontSize] || 'text-base')}>
                <AppLoading />
            </div>
        )
    }
    
    return (
        <div className={cn('antialiased', fontClasses[fontSize] || 'text-base')}>
            {children}
            <LogoutOverlayWrapper />
            <Toaster richColors />
        </div>
    );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Ha-Mim Iron Mart</title>
        <meta name="description" content="Manage your inventory, sales, and finances for Ha-Mim Iron Mart." />
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png"></link>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>
            <LayoutContent>{children}</LayoutContent>
        </AppProvider>
      </body>
    </html>
  );
}
