import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '../primitives/badge'
import type { ProfileIcon, StatusTone } from './types'

/** Divider-separated list container for `RecordRow`s. */
export function RecordList({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot='record-list' className={cn('divide-y', className)} {...props} />
}

export interface RecordRowProps {
  icon: ProfileIcon
  title: React.ReactNode
  subtitle?: React.ReactNode
  status?: { label: string; tone?: StatusTone }
  /** When set the whole row is a button (full-size touch target) with a chevron. */
  onOpen?: () => void | Promise<void>
  /** Accessible name for the button; defaults to the title when it is a string. */
  openLabel?: string
  className?: string
}

const TONE_BADGE: Record<StatusTone, React.ComponentProps<typeof Badge>['variant']> = {
  primary: 'outline',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  muted: 'muted',
}

/** One clinical/administrative record: icon tile, title + subtitle, status chip. */
export function RecordRow({ icon: Icon, title, subtitle, status, onOpen, openLabel, className }: RecordRowProps) {
  const body = (
    <>
      <span className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
        <Icon className='size-5' />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold'>{title}</span>
        {subtitle && <span className='text-muted-foreground block truncate text-xs'>{subtitle}</span>}
      </span>
      {status && (
        <Badge
          variant={TONE_BADGE[status.tone ?? 'muted']}
          className={cn(
            'shrink-0',
            status.tone === 'primary' && 'border-primary/40 bg-primary/10 text-primary'
          )}
        >
          {status.label}
        </Badge>
      )}
      {onOpen && <ChevronRight aria-hidden className='text-muted-foreground size-4 shrink-0' />}
    </>
  )
  return (
    <li data-slot='record-row' className={className}>
      {onOpen ? (
        <button
          type='button'
          aria-label={openLabel ?? (typeof title === 'string' ? `Ver ${title}` : undefined)}
          onClick={() => void onOpen()}
          className='hover:bg-accent/50 focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 rounded-md py-3 text-left outline-none focus-visible:ring-2'
        >
          {body}
        </button>
      ) : (
        <div className='flex min-h-14 items-center gap-3 py-3'>{body}</div>
      )}
    </li>
  )
}
