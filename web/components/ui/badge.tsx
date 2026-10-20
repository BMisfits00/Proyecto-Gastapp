import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#7B68EE]/20 text-[#7B68EE] border-[#7B68EE]/30',
        secondary: 'border-transparent bg-[#252540] text-gray-300',
        destructive: 'border-transparent bg-red-500/20 text-red-400 border-red-500/30',
        success: 'border-transparent bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        outline: 'text-gray-300 border-[#2A2A4A]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
