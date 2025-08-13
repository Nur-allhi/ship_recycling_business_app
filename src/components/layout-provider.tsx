
"use client"
import { AppProvider, useAppContext } from "@/app/store";
import { cn } from "@/lib/utils";

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

function InnerLayout({ children }: { children: React.ReactNode }) {
    const { bodyFont, numberFont } = useAppContext();
     return (
        <html 
        lang="en" 
        suppressHydrationWarning
        style={{
            '--font-body': bodyFont,
            '--font-mono': numberFont,
        } as React.CSSProperties}
        >
        <head>
            <FontLoader />
        </head>
        <body className={cn('font-body antialiased')}>
            {children}
        </body>
        </html>
    );
}

export function LayoutProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
        <AppProvider>
            <InnerLayout>
                {children}
            </InnerLayout>
        </AppProvider>
    )
}
