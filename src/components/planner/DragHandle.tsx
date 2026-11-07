/**
 * components/planner/DragHandle.tsx
 *
 * The one drag handle every task row shows, in the Top 3 and in Tasks, at
 * every width and under either pointer. It used to be a 14px grip at 40%
 * opacity, hidden on narrow screens and absent on phones, so people took the
 * Move up / Move down actions for the only way to move a task.
 *
 * What it does depends on the row around it, not on the handle:
 *  - in a desktop row (HTML5 drag) the whole row is draggable and the handle
 *    is also the keyboard's way in: Alt+Arrow moves, Enter opens the menu;
 *  - in a phone row (`useTouchReorder`) a finger on the handle lifts the row
 *    at once, with no hold, and a mouse on it drags too. Activating it opens
 *    the row's actions, where Move up, Move down and Move to live.
 *
 * `data-drag-handle` is how `useTouchReorder` tells the handle from the body.
 */

import type { HTMLAttributes, Ref } from 'react'
import { GripVertical } from 'lucide-react'

interface DragHandleProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'title'> {
  /** The task's title, for the spoken label "Drag to move <title>". */
  taskTitle: string
  ref?: Ref<HTMLSpanElement>
}

export function DragHandle({ taskTitle, className = '', ref, onKeyDown, ...rest }: DragHandleProps) {
  return (
    <span
      ref={ref}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        // A role="button" span answers Enter and Space like a button, unless
        // the row already did something with the key (the desktop menu).
        if (e.defaultPrevented || !rest.onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.currentTarget.click()
        }
      }}
      role="button"
      tabIndex={0}
      data-drag-handle=""
      aria-label={`Drag to move ${taskTitle}`}
      // touch-none: the browser must not take a finger on the handle for a
      // scroll, or the pointer is cancelled before the row can lift.
      className={`touch-target-coarse inline-flex h-7 w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-share-onSurfaceVariant/80 transition-colors hover:bg-share-surfaceContainerHigh hover:text-share-onSurface focus:outline-none focus-visible:ring-1 focus-visible:ring-share-primary active:cursor-grabbing ${className}`}
      {...rest}
    >
      <GripVertical aria-hidden className="h-4 w-4" />
    </span>
  )
}
