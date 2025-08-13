
"use client"
import { useAppContext } from "@/app/store";
import { cn } from "@/lib/utils";

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const { bodyFont, numberFont } = useAppContext();

    return (
        <div 
            style={{
                '--font-body': bodyFont,
                '--font-mono': numberFont,
            } as React.CSSProperties}
            className={cn('font-body antialiased')}
        >
            {children}
        </div>
    );
}
