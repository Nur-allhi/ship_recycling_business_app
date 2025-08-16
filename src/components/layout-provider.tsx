
"use client"
import { useAppContext } from "@/app/store";
import { cn } from "@/lib/utils";

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    return (
        <div className={cn('antialiased')}>
            {children}
        </div>
    );
}
