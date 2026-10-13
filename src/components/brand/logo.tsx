import { site } from '@/content/site';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
  /** Names the mark for assistive technology. Leave it out when the brand name is written next to it. */
  title?: string;
}

/** The brand mark: an H whose crossbar is a heartbeat. The artwork is also in `src/app/icon.svg`. */
export function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-8 w-8 shrink-0', className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <path d="M18 16V48M46 16V48" className="stroke-primary-foreground" strokeWidth="6" />
      <path d="M18 32H26L30 23L35 42L39 32H46" className="stroke-primary-foreground" strokeWidth="4" />
    </svg>
  );
}

/** The mark followed by the brand name. */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-lg font-bold', className)}>
      <LogoMark className={markClassName} />
      {site.brand.name}
    </span>
  );
}
