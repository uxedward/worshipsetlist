import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'

export function SetlistContextMenu() {
  const menu = useAppStore((s) => s.contextMenu)
  const close = () => useAppStore.getState().setContextMenu(null)
  const openSetlistModal = useAppStore((s) => s.openSetlistModal)
  const askConfirm = useAppStore((s) => s.askConfirm)
  const activeId = useAppStore((s) => s.activeSetlistId)
  const setActive = useAppStore((s) => s.setActiveSetlistId)
  const { duplicateSetlist, deleteSetlist } = useMutations()

  useEffect(() => {
    if (!menu) return
    const onDown = () => close()
    window.addEventListener('click', onDown)
    return () => window.removeEventListener('click', onDown)
  }, [menu])

  if (!menu) return null

  return (
    <div
      className="fixed z-[60] min-w-[180px] overflow-hidden rounded-[12px] py-1"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 40px var(--shadow)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem
        icon={<Pencil size={14} />}
        label="Edit details"
        onClick={() => {
          openSetlistModal(menu.id)
          close()
        }}
      />
      <MenuItem
        icon={<Copy size={14} />}
        label="Duplicate"
        onClick={() => {
          duplicateSetlist.mutate(menu.id, {
            onSuccess: (created) => {
              if (created && typeof created === 'object' && 'id' in created) {
                setActive(String(created.id))
              }
            },
          })
          close()
        }}
      />
      <MenuItem
        icon={<Trash2 size={14} />}
        label="Delete"
        danger
        onClick={() => {
          askConfirm({
            title: 'Delete setlist?',
            message: 'This cannot be undone. Songs in your library will be kept.',
            danger: true,
            confirmLabel: 'Delete',
            onConfirm: () => {
              deleteSetlist.mutate(menu.id, {
                onSuccess: (res) => {
                  const nextId = (res as { nextId?: string })?.nextId
                  if (activeId === menu.id && nextId) setActive(nextId)
                },
              })
            },
          })
          close()
        }}
      />
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]"
      style={{ color: danger ? 'var(--danger)' : 'var(--text)' }}
    >
      {icon}
      {label}
    </button>
  )
}
