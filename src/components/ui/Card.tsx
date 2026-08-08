import * as React from "react";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`bg-surface-level1 border border-border-structural rounded-lg p-md transition-colors hover:border-[#404040] ${className}`}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
