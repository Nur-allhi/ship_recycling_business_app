import Image from 'next/image';
import React from 'react';

const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={cn('relative', className)}>
      <Image
        src="/logo.png"
        alt="ShipShape Ledger Logo"
        fill
        sizes="100%"
        style={{
          objectFit: 'contain',
        }}
        priority // Load the logo quickly
      />
    </div>
  );
};

export default Logo;
