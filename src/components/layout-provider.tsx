
"use client"
import { useEffect } from "react";
import { useAppContext } from "@/app/store";
import { cn } from "@/lib/utils";
import Head from "next/head";

// Helper to create the Google Font URL
const createFontUrl = (fontFamily: string) => {
    if (!fontFamily) return null;
    const family = fontFamily.split(',')[0].replace(/'/g, "").replace(/\s/g, "+");
    return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
};

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const { bodyFont, numberFont } = useAppContext();

    const bodyFontUrl = createFontUrl(bodyFont);
    const numberFontUrl = createFontUrl(numberFont);

    return (
        <>
            <Head>
                {bodyFontUrl && <link key={bodyFontUrl} rel="stylesheet" href={bodyFontUrl} />}
                {numberFontUrl && bodyFontUrl !== numberFontUrl && <link key={numberFontUrl} rel="stylesheet" href={numberFontUrl} />}
            </Head>
            <div 
                style={{
                    '--font-body': bodyFont,
                    '--font-mono': numberFont,
                } as React.CSSProperties}
                className={cn('font-body antialiased')}
            >
                {children}
            </div>
        </>
    );
}
