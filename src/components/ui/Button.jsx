import React from 'react';
import { Icon } from './Icon';

const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
    link: "text-primary underline-offset-4 hover:underline"
};

const sizes = {
    icon: "h-10 w-10",
    sm: "h-9 rounded-md px-3 text-xs",
    md: "h-10 rounded-md px-4 py-2",
    lg: "h-12 rounded-md px-8 text-md"
};

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon,
    className = "",
    disabled,
    ...props
}) => {
    return (
        <button
            disabled={disabled || isLoading}
            className={`
                inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
                ${variants[variant] || variants.primary} 
                ${sizes[size] || sizes.md} 
                ${className}
            `}
            {...props}
        >
            {isLoading ? <Icon name="loader" className="animate-spin" size={size === 'sm' ? 14 : 18} /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 18} />}
            {children}
        </button>
    );
};
