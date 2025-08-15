import { cn } from '@/lib/utils';

const Logo = ({ className }: { className?: string }) => {
  return (
    <img
      src="/logo.png"
      alt="ShipShape Ledger Logo"
      className={cn(className)}
    />
  );
};

export default Logo;
