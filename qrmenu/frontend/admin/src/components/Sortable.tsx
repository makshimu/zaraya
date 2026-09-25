import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from './dndModifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { createContext, useContext, type ReactNode } from 'react'

/** Vertical list reorderable by drag handle (mouse, touch, keyboard). Reports the new id order. */
export function SortableList({
  ids,
  onReorder,
  disabled = false,
  children,
}: {
  ids: number[]
  onReorder: (ids: number[]) => void
  disabled?: boolean
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onReorder(arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id))))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

const HandleContext = createContext<ReturnType<typeof useSortable> | null>(null)

export function SortableItem({ id, children, className = '' }: { id: number; children: ReactNode; className?: string }) {
  const sortable = useSortable({ id })
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 10 : undefined,
    position: 'relative' as const,
  }
  return (
    <div ref={sortable.setNodeRef} style={style} className={`${className} ${sortable.isDragging ? 'opacity-80 shadow-lg' : ''}`}>
      <HandleContext.Provider value={sortable}>{children}</HandleContext.Provider>
    </div>
  )
}

export function DragHandle({ label }: { label: string }) {
  const sortable = useContext(HandleContext)
  if (!sortable) return null
  const disabled = sortable.attributes['aria-disabled']
  return (
    <button
      type="button"
      aria-label={label}
      className={`touch-none rounded p-1 text-slate-300 ${disabled ? 'invisible' : 'cursor-grab hover:text-slate-500 active:cursor-grabbing'}`}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <GripVertical className="size-5" />
    </button>
  )
}
