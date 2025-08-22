
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { AppProvider } from '@/app/context/app-context';
import { LayoutProvider } from '@/components/layout-provider';

export const metadata: Metadata = {
  title: 'Ha-Mim Iron Mart',
  description: 'Manage your inventory, sales, and finances for Ha-Mim Iron Mart.',
  manifest: '/manifest.json',
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>
          <LayoutProvider>
            {children}
            <Toaster richColors />
          </LayoutProvider>
        </AppProvider>
      </body>
    </html>
  );
}
