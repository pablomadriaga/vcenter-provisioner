import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent',
  success: 'bg-green-600 hover:bg-green-700 text-white border-transparent',
};

const sizeStyles: Record<ButtonSize, string> = {
  small: 'px-3 py-1.5 text-sm',
  medium: 'px-4 py-2 text-base',
  large: 'px-6 py-3 text-lg',
};

const baseStyles = `
  inline-flex items-center justify-center font-medium rounded-lg
  border transition-all duration-200 ease-in-out
  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
  disabled:opacity-50 disabled:cursor-not-allowed
`;

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  onClick,
  className = '',
  'data-testid': testId = 'button',
}) => {
  return (
    <button
      type={type}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      onClick={onClick}
      data-testid={testId}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
