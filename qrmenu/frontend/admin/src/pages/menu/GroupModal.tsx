import { Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useDeleteGroup, useSaveGroup } from '../../api/menu'
import type { Modifier, ModifierGroup, ModifierGroupInput } from '../../api/types'
import LocalizedField from '../../components/LocalizedField'
import Modal from '../../components/Modal'
import MoneyInput from '../../components/MoneyInput'
import { btn, input, label } from '../../components/ui'
import { useContentLocale, useErrorText } from './shared'

type ModifierDraft = Omit<Modifier, 'price'> & { price: number | null; uid: number }
let uid = 0

export default function GroupModal({ group, onClose }: { group: ModifierGroup | null; onClose: () => void }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const errorText = useErrorText()
  const save = useSaveGroup()
  const remove = useDeleteGroup()

  const [form, setForm] = useState<Omit<ModifierGroupInput, 'modifiers'>>({
    name: group?.name ?? {},
    min_select: group?.min_select ?? 0,
    max_select: group?.max_select ?? 1,
    is_required: group?.is_required ?? false,
  })
  const [modifiers, setModifiers] = useState<ModifierDraft[]>(
    (group?.modifiers ?? []).map((m) => ({ ...m, uid: ++uid })),
  )
  const setModifier = (i: number, patch: Partial<ModifierDraft>) =>
    setModifiers(modifiers.map((m, j) => (j === i ? { ...m, ...patch } : m)))

  const rangeInvalid = form.min_select > form.max_select
  const valid = !rangeInvalid && modifiers.every((m) => m.price !== null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const data: ModifierGroupInput = {
      ...form,
      modifiers: modifiers.map(({ id, name, price, is_available }) => ({ id, name, price: price!, is_available })),
    }
    save.mutate({ id: group?.id, data }, { onSuccess: onClose })
  }

  return (
    <Modal title={group ? content.t(group.name) : t('menu.addGroup')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <LocalizedField
          id="group-name"
          label={t('menu.name')}
          value={form.name}
          onChange={(name) => setForm({ ...form, name })}
          languages={content.languages}
          required
        />
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={label} htmlFor="g-min">
              {t('menu.minSelect')}
            </label>
            <input
              id="g-min"
              type="number"
              min={0}
              max={50}
              className={input.replace('w-full', 'w-24')}
              value={form.min_select}
              onChange={(e) => {
                const min = Number(e.target.value)
                setForm({ ...form, min_select: min, is_required: min > 0 })
              }}
            />
          </div>
          <div>
            <label className={label} htmlFor="g-max">
              {t('menu.maxSelect')}
            </label>
            <input
              id="g-max"
              type="number"
              min={1}
              max={50}
              className={input.replace('w-full', 'w-24')}
              value={form.max_select}
              onChange={(e) => setForm({ ...form, max_select: Number(e.target.value) })}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_required}
              onChange={(e) =>
                setForm({ ...form, is_required: e.target.checked, min_select: e.target.checked ? Math.max(1, form.min_select) : 0 })
              }
            />
            {t('menu.required')}
          </label>
        </div>
        {rangeInvalid && <p className="text-sm text-red-600">{t('menu.minGtMax')}</p>}

        <fieldset className="rounded-xl bg-slate-50 p-4">
          <legend className="sr-only">{t('menu.modifiers')}</legend>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium">{t('menu.modifiers')}</span>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => setModifiers([...modifiers, { name: {}, price: 0, is_available: true, uid: ++uid }])}
            >
              <Plus className="size-4" /> {t('menu.addModifier')}
            </button>
          </div>
          {modifiers.length === 0 && <p className="text-sm text-slate-500">{t('menu.noModifiers')}</p>}
          <div className="space-y-3">
            {modifiers.map((m, i) => (
              <div key={m.uid} className="flex flex-wrap items-start gap-3 rounded-lg bg-white p-3">
                <div className="min-w-48 flex-1">
                  <LocalizedField
                    id={`mod-${m.uid}`}
                    label={t('menu.name')}
                    value={m.name}
                    onChange={(name) => setModifier(i, { name })}
                    languages={content.languages}
                    required
                  />
                </div>
                <div className="w-44">
                  <label className={label} htmlFor={`mod-price-${m.uid}`}>
                    {t('menu.surcharge')}
                  </label>
                  <MoneyInput
                    id={`mod-price-${m.uid}`}
                    value={m.price}
                    currency={content.currency}
                    onChange={(price) => setModifier(i, { price })}
                  />
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!m.is_available}
                      onChange={(e) => setModifier(i, { is_available: !e.target.checked })}
                    />
                    {t('menu.outOfStock')}
                  </label>
                </div>
                <button
                  type="button"
                  className={`${btn.icon} mt-6`}
                  onClick={() => setModifiers(modifiers.filter((_, j) => j !== i))}
                  aria-label={t('common.delete')}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </fieldset>

        {save.error && <p className="text-sm text-red-600">{errorText(save.error)}</p>}
        <div className="flex justify-between gap-2">
          {group ? (
            <button
              type="button"
              className={btn.danger}
              onClick={() =>
                confirm(t('menu.confirmDeleteGroup', { name: content.t(group.name) })) &&
                remove.mutate(group.id, { onSuccess: onClose })
              }
            >
              <Trash2 className="size-4" /> {t('common.delete')}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className={btn.primary} disabled={save.isPending || !valid}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
