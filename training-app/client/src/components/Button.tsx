import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, loading, variant = 'primary', disabled, className = '', ...props }, ref) => {
    const baseClass = 'rounded-lg px-4 py-3.5 text-[15px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
    
    const variantClass = variant === 'primary'
      ? 'bg-[#0A2942] text-white hover:bg-[#1B3A5C] focus:ring-[#0A2942]/30 active:scale-[0.99]'
      : 'bg-white text-[#0A2942] border border-[#D8E0E8] hover:bg-[#F6F8FA] hover:border-[#0A2942]/20 focus:ring-[#0A2942]/20 active:scale-[0.99]';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClass} ${variantClass} ${className}`}
        {...props}
      >
        {loading ? 'Memproses...' : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
