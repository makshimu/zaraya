import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../api/client'
import { uploadImage } from '../api/menu'
import { btn } from './ui'

export interface PickedImage {
  key: string | null
  url: string | null
}

export default function ImagePicker({ value, onChange }: { value: PickedImage; onChange: (v: PickedImage) => void }) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File) {
    setBusy(true)
    setError(null)
    try {
      const { key, urls } = await uploadImage(file)
      onChange({ key, url: urls.w400 })
    } catch (err) {
      setError(t(`errors.${err instanceof ApiError ? err.code : 'unknown_error'}`, t('errors.unknown_error')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {busy ? (
          <Loader2 className="size-6 animate-spin text-slate-400" />
        ) : value.url ? (
          <img src={value.url} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-slate-300" />
        )}
      </div>
      <div className="space-y-1">
        <div className="flex gap-2">
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> {t('menu.uploadPhoto')}
          </button>
          {value.key && (
            <button
              type="button"
              className={btn.icon}
              aria-label={t('menu.removePhoto')}
              onClick={() => onChange({ key: null, url: null })}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) pick(file)
        }}
      />
    </div>
  )
}
