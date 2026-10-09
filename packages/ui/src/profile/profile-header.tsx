import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ProfileHeaderProps extends Omit<React.ComponentProps<'header'>, 'title'> {
  /** Avatar (any node; the caller sizes it). */
  avatar: React.ReactNode
  title: React.ReactNode
  /** Line under the title: license, record number… */
  subtitle?: React.ReactNode
  /** Status chips row. */
  badges?: React.ReactNode
  /** Free content under the chips: specialties, facts… */
  meta?: React.ReactNode
  /** Tappable contact links row (`ContactLink`). */
  contacts?: React.ReactNode
  /** Action buttons: full-width grid on phones, a column beside the body on `lg`. */
  actions?: React.ReactNode
  /**
   * `stacked`: centered column on phones, row from `lg` (public profiles).
   * `inline`: avatar beside the text at every width (records, dense views).
   */
  layout?: 'stacked' | 'inline'
}

/**
 * Header of a person/entity page that floats on the panel instead of sitting
 * in its own card — avoids the card-in-a-card nesting on narrow screens.
 */
export function ProfileHeader({
  avatar,
  title,
  subtitle,
  badges,
  meta,
  contacts,
  actions,
  layout = 'stacked',
  className,
  ...props
}: ProfileHeaderProps) {
  const stacked = layout === 'stacked'
  return (
    <header
      data-slot='profile-header'
      className={cn(
        'flex gap-5',
        stacked
          ? 'flex-col items-center text-center lg:flex-row lg:items-start lg:gap-8 lg:text-left'
          : 'flex-col',
        className
      )}
      {...props}
    >
      <div className={cn('flex min-w-0 gap-4', stacked ? 'contents' : 'items-center')}>
        <div className='shrink-0'>{avatar}</div>
        <div className={cn('min-w-0 flex-1 space-y-3', stacked && 'w-full')}>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight break-words text-balance sm:text-3xl'>{title}</h1>
            {subtitle && <div className='text-muted-foreground text-sm'>{subtitle}</div>}
          </div>
          {badges && (
            <div className={cn('flex flex-wrap items-center gap-2', stacked && 'justify-center lg:justify-start')}>
              {badges}
            </div>
          )}
          {meta}
          {contacts && (
            <div className={cn('flex flex-wrap items-center gap-2', stacked && 'justify-center lg:justify-start')}>
              {contacts}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div
          className={cn(
            'grid w-full grid-cols-2 gap-2',
            stacked ? 'max-w-sm lg:w-44 lg:max-w-none lg:grid-cols-1' : 'sm:flex sm:flex-wrap'
          )}
        >
          {actions}
        </div>
      )}
    </header>
  )
}
