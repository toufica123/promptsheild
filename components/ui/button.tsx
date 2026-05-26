import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "outline" | "ghost";
};

export function Button({
  className,
  variant = "gold",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518] disabled:pointer-events-none disabled:opacity-50",
        variant === "gold" &&
          "bg-[#F5C518] text-[#0D0D0D] shadow-[0_0_0_rgba(245,197,24,0)] hover:shadow-[0_0_32px_rgba(245,197,24,0.35)]",
        variant === "outline" &&
          "border border-[#F5C518] bg-transparent text-white hover:bg-[#F5C518] hover:text-[#0D0D0D] hover:shadow-[0_0_32px_rgba(245,197,24,0.24)]",
        variant === "ghost" &&
          "text-[#A0A0A0] hover:text-white",
        className,
      )}
      {...props}
    />
  );
}
