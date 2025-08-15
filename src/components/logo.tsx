import Image from 'next/image';
import { cn } from '@/lib/utils';

const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={cn('relative', className)}>
      <Image
        src="/logo.png"
        alt="ShipShape Ledger Logo"
        fill
        sizes="100vw"
        style={{ objectFit: 'contain' }}
        priority 
      />
    </div>
  );
};

export default Logo;
