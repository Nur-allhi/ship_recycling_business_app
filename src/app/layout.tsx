
"use client";

import './globals.css';
import { Toaster } from 'sonner';
import { AppProvider } from '@/app/context/app-context';

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
          {children}
          <Toaster richColors />
        </AppProvider>
      </body>
    </html>
  );
}
