import * as React from 'react';
import { cn } from '@/components/ui/cn';
import { inputBase } from '@/components/ui/input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputBase, 'min-h-[96px] resize-y py-2.5 leading-6 md:leading-6', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
