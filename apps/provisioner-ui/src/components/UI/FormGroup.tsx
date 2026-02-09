import React from 'react';

export interface FormGroupProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  label,
  htmlFor,
  required = false,
  error,
  helpText,
  children,
  className = '',
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

export default FormGroup;
