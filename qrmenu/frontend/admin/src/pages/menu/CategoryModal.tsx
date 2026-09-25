import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useDeleteCategory, useSaveCategory } from '../../api/menu'
import type { Category, CategoryInput } from '../../api/types'
import ImagePicker from '../../components/ImagePicker'
import LocalizedField from '../../components/LocalizedField'
import Modal from '../../components/Modal'
import { btn, input, label } from '../../components/ui'
import { useContentLocale, useErrorText } from './shared'

export default function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const errorText = useErrorText()
  const save = useSaveCategory()
  const remove = useDeleteCategory()

  const [form, setForm] = useState<CategoryInput>({
    name: category?.name ?? {},
    image: category?.image ?? null,
    is_enabled: category?.is_enabled ?? true,
    available_from: category?.available_from?.slice(0, 5) ?? null,
    available_to: category?.available_to?.slice(0, 5) ?? null,
  })
  const [imageUrl, setImageUrl] = useState(category?.image_urls?.w400 ?? null)
  const [scheduled, setScheduled] = useState(!!category?.available_from)

  function submit(e: FormEvent) {
    e.preventDefault()
    const data = scheduled ? form : { ...form, available_from: null, available_to: null }
    save.mutate({ id: category?.id, data }, { onSuccess: onClose })
  }

  return (
    <Modal title={category ? content.t(category.name) : t('menu.addCategory')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <LocalizedField
          id="cat-name"
          label={t('menu.name')}
          value={form.name}
          onChange={(name) => setForm({ ...form, name })}
          languages={content.languages}
          required
        />
        <div>
          <span className={label}>{t('menu.photoOptional')}</span>
          <ImagePicker
            value={{ key: form.image, url: imageUrl }}
            onChange={({ key, url }) => {
              setForm({ ...form, image: key })
              setImageUrl(url)
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
          {t('menu.enabled')}
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(e) => {
                setScheduled(e.target.checked)
                if (e.target.checked && !form.available_from)
                  setForm({ ...form, available_from: '18:00', available_to: '23:59' })
              }}
            />
            {t('menu.schedule')}
          </label>
          {scheduled && (
            <div className="flex items-center gap-2 pl-6 text-sm">
              <span>{t('menu.from')}</span>
              <input
                type="time"
                required
                aria-label={t('menu.from')}
                className={`${input} w-32`}
                value={form.available_from ?? ''}
                onChange={(e) => setForm({ ...form, available_from: e.target.value })}
              />
              <span>{t('menu.to')}</span>
              <input
                type="time"
                required
                aria-label={t('menu.to')}
                className={`${input} w-32`}
                value={form.available_to ?? ''}
                onChange={(e) => setForm({ ...form, available_to: e.target.value })}
              />
            </div>
          )}
        </div>
        {save.error && <p className="text-sm text-red-600">{errorText(save.error)}</p>}
        <div className="flex justify-between gap-2">
          {category ? (
            <button
              type="button"
              className={btn.danger}
              onClick={() =>
                confirm(t('menu.confirmDeleteCategory', { name: content.t(category.name) })) &&
                remove.mutate(category.id, { onSuccess: onClose })
              }
            >
              <Trash2 className="size-4" /> {t('common.delete')}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
