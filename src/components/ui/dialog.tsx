import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { useEffect } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="relative z-50">{children}</div>
    </div>
  );
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
  return (
    <div
      className={cn(
        // grid-cols-1 is minmax(0, 1fr): the column never grows past the modal because of its
        // widest child. The height is capped and scrolls, so a tall form is never cut off by the
        // screen; a modal that sets its own max-h or overflow keeps it (twMerge).
        'fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] grid-cols-1 gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    // Wraps instead of pushing the last button out of the modal when they do not fit in a row.
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end sm:gap-y-2 sm:space-x-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
