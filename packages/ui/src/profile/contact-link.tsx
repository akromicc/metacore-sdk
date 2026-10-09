import * as React from 'react'
import { cn } from '@/lib/utils'
import type { ProfileIcon } from './types'

export interface ContactLinkProps extends Omit<React.ComponentProps<'a'>, 'children'> {
  icon: ProfileIcon
  children: React.ReactNode
}

/** Pill-shaped tappable link (mailto:, tel:, maps…) with a 40px minimum touch height. */
export function ContactLink({ icon: Icon, children, className, ...props }: ContactLinkProps) {
  return (
    <a
      data-slot='contact-link'
      className={cn(
        'hover:bg-accent focus-visible:ring-ring inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2',
        className
      )}
      {...props}
    >
      <Icon className='text-muted-foreground size-4 shrink-0' />
      <span className='min-w-0 truncate'>{children}</span>
    </a>
  )
}
