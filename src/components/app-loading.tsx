
import { cn } from '@/lib/utils';
import Logo from './logo';

export function AppLoading() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="loader"></div>
                <p className="text-muted-foreground">Loading your ledger...</p>
            </div>
        </div>
    );
}
