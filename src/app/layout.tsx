
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AppProvider } from '@/app/store';
import { LayoutProvider } from '@/components/layout-provider';

export const metadata: Metadata = {
  title: 'ShipShape Ledger',
  description: 'Track your cash, bank, and stock transactions with ease.',
};

const fontUrls = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap",
  "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500&display=swap",
  "https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500&display=swap",
];


function FontLoader() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {fontUrls.map(url => <link key={url} href={url} rel="stylesheet" />)}
    </>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <FontLoader />
      </head>
      <body>
        <AppProvider>
          <LayoutProvider>
            {children}
            <Toaster />
          </LayoutProvider>
        </AppProvider>
      </body>
    </html>
  );
}
