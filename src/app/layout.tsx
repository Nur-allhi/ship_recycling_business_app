
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { LayoutProvider } from '@/components/layout-provider';

export const metadata: Metadata = {
  title: 'ShipShape Ledger',
  description: 'Track your cash, bank, and stock transactions with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <LayoutProvider>
        {children}
        <Toaster />
    </LayoutProvider>
  );
}
