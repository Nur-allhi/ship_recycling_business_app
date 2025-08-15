import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  isAnimated?: boolean;
}

const Logo = ({ className, isAnimated = true }: LogoProps) => {
  return (
    <div className={cn('w-12 h-12', className)}>
      <style>
        {`
          @keyframes sail {
            0% { transform: rotate(-2deg) translateY(0px); }
            50% { transform: rotate(2deg) translateY(-2px); }
            100% { transform: rotate(-2deg) translateY(0px); }
          }
          .sailing-animation {
            animation: sail 4s ease-in-out infinite;
          }
        `}
      </style>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn('w-full h-full', isAnimated && 'sailing-animation')}
      >
        {/* Mast and Sail */}
        <path d="M9 17v-8l6 4-6 4"></path>
        <line x1="9" y1="9" x2="9" y2="4"></line>
        
        {/* Ship Body */}
        <path d="M2 20a12 12 0 0 0 20 0"></path>
        <path d="M3 17h18"></path>
        <path d="M4 14h16"></path>
      </svg>
    </div>
  );
};

export default Logo;
