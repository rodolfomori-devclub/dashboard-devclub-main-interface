import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

// The shadcn/Radix checkbox API (a button with role="checkbox") without a new
// dependency. A surrounding <label> or htmlFor toggles it like the original.
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, onClick, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
      className={cn(
        "peer flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {checked && <Check className="h-4 w-4" aria-hidden="true" />}
    </button>
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
