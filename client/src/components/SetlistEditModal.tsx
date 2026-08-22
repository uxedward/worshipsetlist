import { useEffect, useState } from 'react'
import { DESCRIPTION_MAX } from '@shared/types.ts'
import type { Setlist } from '@shared/types.ts'
import { formatDateInput } from '@shared/duration.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { Btn, Field, inputClass, inputStyle } from './ui.tsx'
import { X } from 'lucide-react'

export function SetlistEditModal({ setlists }: { setlists: Setlist[] }) {
  const id = useAppStore((s) => s.setlistModalId)
  const close = useAppStore((s) => s.closeSetlistModal)
  const setActive = useAppStore((s) => s.setActiveSetlistId)
  const { createSetlist, patchSetlist } = useMutations()
  const existing = id && id !== 'new' ? setlists.find((s) => s.id === id) : undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    if (!id) return
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setServiceName(existing.serviceName ?? '')
      setDate(formatDateInput(existing.date))
    } else {
      setName('')
      setDescription('')
      setServiceName('')
      setDate('')
    }
  }, [id, existing])

  if (!id) return null

  const save = async () => {
    if (!name.trim()) return
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      serviceName: serviceName.trim() || null,
      date: date || null,
    }
    if (id === 'new') {
      const created = (await createSetlist.mutateAsync(body)) as Setlist
      if (created?.id) setActive(created.id)
    } else {
      await patchSetlist.mutateAsync({ id, body })
    }
    close()
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-full max-w-md rounded-[12px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-[20px]">{id === 'new' ? 'New setlist' : 'Edit details'}</h3>
          <button type="button" onClick={close} style={{ color: 'var(--text-dim)' }}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Name">
            <input className={inputClass} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Service name">
            <input
              className={inputClass}
              style={inputStyle}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              style={inputStyle}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Description">
            <textarea
              maxLength={DESCRIPTION_MAX}
              className="h-24 w-full rounded-[6px] p-3 text-[13px] outline-none"
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
            />
            <div className="mt-1 text-right text-[11px]" style={{ color: 'var(--text-faint)' }}>
              {description.length}/{DESCRIPTION_MAX}
            </div>
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn ghost onClick={close}>
            Cancel
          </Btn>
          <Btn accent disabled={!name.trim()} onClick={() => void save()}>
            Save
          </Btn>
        </div>
      </div>
    </div>
  )
}
