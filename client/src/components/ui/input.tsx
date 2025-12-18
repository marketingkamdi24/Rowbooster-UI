import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-base text-white ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white/70 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--rb-cyan)]/50 focus-visible:border-[color:var(--rb-cyan)]/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
