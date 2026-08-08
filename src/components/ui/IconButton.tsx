import * as React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  variant?: "ghost" | "outline" | "solid";
  iconSize?: number;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className = "", icon, variant = "ghost", iconSize = 16, ...props }, ref) => {
    const baseStyles = "flex items-center justify-center rounded transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 text-on-surface-variant hover:text-on-surface";
    
    const variants = {
      ghost: "hover:bg-surface-container-high",
      outline: "border border-outline-variant/30 hover:bg-surface-container-high bg-surface-container",
      solid: "bg-surface-container-high hover:bg-[#00a2e6] hover:text-white",
    };

    return (
      <button
        ref={ref}
        className={`w-8 h-8 ${baseStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        <span className="material-symbols-outlined" style={{ fontSize: iconSize }}>{icon}</span>
      </button>
    );
  }
);
IconButton.displayName = "IconButton";

export { IconButton };
