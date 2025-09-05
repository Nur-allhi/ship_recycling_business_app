
"use client"
import { useAppContext } from "@/app/context/app-context";
import { cn } from "@/lib/utils";
import { AppLoading } from "./app-loading";

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const { fontSize, isLoading, isInitialLoadComplete } = useAppContext();
    const fontClasses = {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-xl',
    };

    const MainContent = () => {
        if (isLoading || !isInitialLoadComplete) {
            return <AppLoading />;
        }
        return <>{children}</>;
    };

    return (
        <div className={cn('antialiased', fontClasses[fontSize] || 'text-base')}>
            <MainContent />
        </div>
    );
}
