import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary" | "success" | "warning";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = "", variant = "primary", ...props }, ref) => {
    const variants = {
      primary: "bg-primary-container/20 text-primary",
      secondary: "bg-secondary-container/20 text-secondary",
      success: "bg-tertiary-container/20 text-tertiary",
      warning: "bg-error-container/20 text-error",
    };

    return (
      <div
        ref={ref}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
