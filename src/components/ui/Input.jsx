import React, { forwardRef } from 'react';
import { Icon } from './Icon';

export const Input = forwardRef(({ icon, className = "", ...props }, ref) => {
    return (
        <div className="relative w-full">
            {icon && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <Icon name={icon} size={18} />
                </div>
            )}
            <input
                ref={ref}
                className={`
                    flex h-12 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50
                    ${icon ? 'pl-10' : 'pl-3'} 
                    ${className}
                `}
                {...props}
            />
        </div>
    );
});

Input.displayName = "Input";
