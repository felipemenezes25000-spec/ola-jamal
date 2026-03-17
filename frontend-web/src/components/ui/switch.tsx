import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, onClick, className }, ref) => (
    <button
      ref={ref}
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        onClick?.(e);
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-blue-600" : "bg-gray-200",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
);
Switch.displayName = "Switch";

export { Switch };
