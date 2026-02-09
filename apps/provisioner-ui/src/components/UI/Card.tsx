import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'small' | 'medium' | 'large';
  hover?: boolean;
}

const paddingStyles: Record<string, string> = {
  none: '',
  small: 'p-4',
  medium: 'p-6',
  large: 'p-8',
};

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<{ children: React.ReactNode; className?: string }>;
  Footer: React.FC<{ children: React.ReactNode; className?: string }>;
} = ({ children, className = '', padding = 'medium', hover = false }) => {
  return (
    <div
      className={`
        bg-white rounded-xl border border-gray-200 shadow-sm
        ${paddingStyles[padding]}
        ${hover ? 'transition-shadow duration-200 hover:shadow-md' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

Card.Header = ({ title, subtitle, action }: CardHeaderProps) => (
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

Card.Body = ({ children, className = '' }) => (
  <div className={className}>{children}</div>
);

Card.Footer = ({ children, className = '' }) => (
  <div className={`mt-4 pt-4 border-t border-gray-200 ${className}`}>
    {children}
  </div>
);

export default Card;
