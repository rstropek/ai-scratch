import { LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cx } from './cx.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet' | 'on-bar';
export type ButtonSize = 'md' | 'sm';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white enabled:hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-foreground enabled:hover:bg-subtle',
  danger: 'bg-danger text-white enabled:hover:bg-danger-hover',
  quiet: 'text-primary-hover enabled:hover:bg-primary-light enabled:hover:text-primary-ink',
  // on the purple top bar
  'on-bar': 'border border-white/55 text-white enabled:hover:bg-white/15',
};

const sizes: Record<ButtonSize, string> = {
  md: 'px-4 py-2.75',
  sm: 'px-2.5 py-1.75',
};

/** The button look, for anything that must look like a button (a link to a form, say). */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md') =>
  cx(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button font-bold text-sm leading-none',
    'transition-colors duration-150 ease-out focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-55',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
  );

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** a request is running: spinner, disabled */
  pending?: boolean;
};

export function Button({
  variant,
  size,
  pending = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cx(buttonClass(variant, size), className)}
      {...props}
    >
      {pending && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
}
