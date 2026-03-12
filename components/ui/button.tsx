// Button Component
import React from 'react';

export function Button({
  children,
  variant = 'default',
  size = 'default',
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const baseStyles =
    'rounded font-medium transition-colors inline-flex items-center justify-center';

  const sizeStyles = {
    default: 'px-4 py-2 text-sm',
    sm: 'px-3 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base',
  };

  const variantStyles =
    variant === 'outline'
      ? 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
      : 'bg-blue-600 hover:bg-blue-700 text-white';
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
}
