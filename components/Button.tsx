
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'info' | 'special';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyle = "font-bold rounded-lg shadow-md transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

  const sizeStyles = {
    sm: "py-2 px-3 text-sm",
    md: "py-3 px-5 text-base", // Adjusted from original py-3 px-6 text-xl for wider use
    lg: "py-3 px-6 text-lg",
  };

  const variantStyles = {
    primary: "bg-green-500 hover:bg-green-600 text-white focus:ring-green-400",
    secondary: "bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400",
    danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-400",
    warning: "bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-400",
    info: "bg-purple-500 hover:bg-purple-600 text-white focus:ring-purple-400",
    special: "bg-indigo-500 hover:bg-indigo-600 text-white focus:ring-indigo-400",
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
