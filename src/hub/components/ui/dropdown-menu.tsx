import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

// A small menu with shadcn's DropdownMenu API on top of the Radix popover the
// Dashboard already ships. Items close the menu; arrow keys move between them.
const DropdownMenu = PopoverPrimitive.Root;

const DropdownMenuTrigger = PopoverPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 4, onKeyDown, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      role="menu"
      align={align}
      sideOffset={sideOffset}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
        if (!items.length) return;
        event.preventDefault();
        const current = items.indexOf(document.activeElement as HTMLElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(current + step + items.length) % items.length].focus();
      }}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <PopoverPrimitive.Close asChild>
      <Comp
        ref={ref}
        role="menuitem"
        className={cn(
          "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Close>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
