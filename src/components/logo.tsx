import Image from 'next/image';
import React from 'react';
import { cn } from '@/lib/utils';

const Logo = ({ className }: { className?: string }) => {
  return (
    <Image
      src="/logo.png"
      alt="ShipShape Ledger Logo"
      width={0}
      height={0}
      className={cn("w-full h-auto", className)}
      priority 
    />
  );
};

export default Logo;
