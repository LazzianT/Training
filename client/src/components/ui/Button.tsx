import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export const Button = ({ variant = 'primary', children, className = '', ...props }: ButtonProps) => {
  const tone =
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-700'
      : variant === 'danger'
        ? 'border border-red-500 bg-white text-red-700 hover:bg-red-50'
        : 'border border-slate-300 bg-white text-slate-900 hover:border-slate-900';

  return (
    <button
      className={`flex h-11 items-center justify-center px-4 text-sm font-semibold outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
