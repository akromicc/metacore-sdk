import * as React from 'react'
import { cn } from '@/lib/utils'
import { TabsList, TabsTrigger } from '../primitives/tabs'

/**
 * Horizontally scrollable pill tabs that stick to the top of their scroll
 * container with a blurred backdrop. Use inside `<Tabs>`; pair with
 * `PillTabsTrigger` (icon + text stay visible on phones).
 */
export function PillTabsList({ className, children, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <div
      data-slot='pill-tabs'
      className='bg-background/80 sticky top-0 z-10 -mx-4 border-b px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-2'
    >
      <TabsList
        className={cn(
          'h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className
        )}
        {...props}
      >
        {children}
      </TabsList>
    </div>
  )
}

export function PillTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-10 flex-none gap-1.5 rounded-full px-3.5 data-[state=active]:shadow-none',
        className
      )}
      {...props}
    />
  )
}
