"use client"; // Convert to client component to use useEffect

import './globals.css';
import { Toaster } from 'sonner';
import { AppProvider } from '@/app/context/app-context';
import { LayoutProvider } from '@/components/layout-provider';
import LogoutOverlayWrapper from '@/components/logout-overlay-wrapper';
import { useEffect } from 'react'; // Import useEffect

// Metadata object is removed to comply with "use client" directive.
// PWA details are in manifest.json, and the title can be set in the <head> directly.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  useEffect(() => {
    // This hook runs only on the client side, after the component mounts.
    // We check if the manifest link already exists to avoid duplicates.
    if (!document.querySelector("link[rel='manifest']")) {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Ha-Mim Iron Mart</title>
        {/* The manifest link will be added dynamically via the useEffect hook */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icon-192x192.png"></link>
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body>
        <AppProvider>
          <LayoutProvider>
            {children}
            <LogoutOverlayWrapper />
            <Toaster richColors />
          </LayoutProvider>
        </AppProvider>
      </body>
    </html>
  );
}
