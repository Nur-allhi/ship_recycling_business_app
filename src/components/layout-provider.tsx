
"use client"
import { useAppContext } from "@/app/context/app-context";
import { cn } from "@/lib/utils";

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const { fontSize } = useAppContext();
    const fontClasses = {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-xl',
    };

    return (
        <div className={cn('antialiased', fontClasses[fontSize] || 'text-base')}>
            {children}
        </div>
    );
}
