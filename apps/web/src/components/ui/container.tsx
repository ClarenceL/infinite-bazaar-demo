import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {}

const Container = forwardRef<HTMLDivElement, ContainerProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
});

Container.displayName = "Container";

export { Container };
