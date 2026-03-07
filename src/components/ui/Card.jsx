import React from 'react';

export const Card = ({ children, className = "", noShadow = false, ...props }) => {
    return (
        <div
            className={`
                rounded-xl border border-border bg-card text-card-foreground shadow-sm
                ${className}
            `}
            {...props}
        >
            {children}
        </div>
    );
};
