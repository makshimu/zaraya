import { Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useDeleteItem, useSaveItem } from '../../api/menu'
import { BADGES, type Category, type Item, type ItemInput, type ModifierGroup, type Price } from '../../api/types'
import ImagePicker from '../../components/ImagePicker'
import LocalizedField from '../../components/LocalizedField'
import Modal from '../../components/Modal'
import MoneyInput from '../../components/MoneyInput'
import { btn, input, label } from '../../components/ui'
import { useContentLocale, useErrorText } from './shared'

type PriceDraft = Omit<Price, 'amount'> & { amount: number | null; uid: number }

let uid = 0

export default function ItemModal({
  item,
  categoryId,
  categories,
  groups,
  onClose,
}: {
  item: Item | null
  categoryId: number
  categories: Category[]
  groups: ModifierGroup[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const errorText = useErrorText()
  const save = useSaveItem()
  const remove = useDeleteItem()

  const [form, setForm] = useState<Omit<ItemInput, 'prices'>>({
    category_id: item?.category_id ?? categoryId,
    name: item?.name ?? {},
    description: item?.description ?? {},
    image: item?.image ?? null,
    is_enabled: item?.is_enabled ?? true,
    is_available: item?.is_available ?? true,
    badges: item?.badges ?? [],
    modifier_group_ids: item?.modifier_group_ids ?? [],
  })
  const [imageUrl, setImageUrl] = useState(item?.image_urls?.w400 ?? null)
  const [prices, setPrices] = useState<PriceDraft[]>(
    (item?.prices ?? [{ name: {}, amount: null as unknown as number, is_default: true }]).map((p) => ({ ...p, uid: ++uid })),
  )
  const pricesValid = prices.every((p) => p.amount !== null)

  const setPrice = (i: number, patch: Partial<PriceDraft>) =>
    setPrices(prices.map((p, j) => (j === i ? { ...p, ...patch } : patch.is_default ? { ...p, is_default: false } : p)))

  function removePrice(i: number) {
    const next = prices.filter((_, j) => j !== i)
    if (!next.some((p) => p.is_default)) next[0] = { ...next[0], is_default: true }
    setPrices(next)
  }

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!pricesValid) return
    const data: ItemInput = {
      ...form,
      prices: prices.map(({ id, name, amount, is_default }) => ({ id, name, amount: amount!, is_default })),
    }
    save.mutate({ id: item?.id, data }, { onSuccess: onClose })
  }

  return (
    <Modal title={item ? content.t(item.name) : t('menu.addItem')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <LocalizedField
              id="item-name"
              label={t('menu.name')}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              languages={content.languages}
              required
            />
            <LocalizedField
              id="item-desc"
              label={t('menu.description')}
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
              languages={content.languages}
              multiline
            />
          </div>
          <div className="space-y-4">
            <div>
              <span className={label}>{t('menu.photo')}</span>
              <ImagePicker
                value={{ key: form.image, url: imageUrl }}
                onChange={({ key, url }) => {
                  setForm({ ...form, image: key })
                  setImageUrl(url)
                }}
              />
            </div>
            <div>
              <label className={label} htmlFor="item-cat">
                {t('menu.category')}
              </label>
              <select
                id="item-cat"
                className={input}
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {content.t(c.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
                {t('menu.enabled')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!form.is_available}
                  onChange={(e) => setForm({ ...form, is_available: !e.target.checked })}
                />
                {t('menu.outOfStock')}
              </label>
            </div>
            <fieldset>
              <legend className={label}>{t('menu.badges')}</legend>
              <div className="flex flex-wrap gap-2">
                {BADGES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={form.badges.includes(b)}
                    onClick={() => setForm({ ...form, badges: toggleIn(form.badges, b) })}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      form.badges.includes(b) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {t(`badges.${b}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <fieldset className="rounded-xl bg-slate-50 p-4">
          <legend className="sr-only">{t('menu.prices')}</legend>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium">{t('menu.prices')}</span>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => setPrices([...prices, { name: {}, amount: null, is_default: false, uid: ++uid }])}
            >
              <Plus className="size-4" /> {t('menu.addPrice')}
            </button>
          </div>
          <div className="space-y-3">
            {prices.map((p, i) => (
              <div key={p.uid} className="flex flex-wrap items-start gap-3 rounded-lg bg-white p-3" data-testid="price-row">
                <div className="min-w-48 flex-1">
                  <LocalizedField
                    id={`price-${p.uid}`}
                    label={t('menu.priceName')}
                    value={p.name}
                    onChange={(name) => setPrice(i, { name })}
                    languages={content.languages}
                  />
                </div>
                <div className="w-44">
                  <label className={label} htmlFor={`amount-${p.uid}`}>
                    {t('menu.amount')}
                  </label>
                  <MoneyInput
                    id={`amount-${p.uid}`}
                    value={p.amount}
                    currency={content.currency}
                    onChange={(amount) => setPrice(i, { amount })}
                  />
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="radio" name="default-price" checked={p.is_default} onChange={() => setPrice(i, { is_default: true })} />
                    {t('menu.default')}
                  </label>
                </div>
                {prices.length > 1 && (
                  <button type="button" className={`${btn.icon} mt-6`} onClick={() => removePrice(i)} aria-label={t('common.delete')}>
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={label}>{t('menu.modifierGroups')}</legend>
          {groups.length === 0 ? (
            <p className="text-sm text-slate-500">{t('menu.noGroupsYet')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.modifier_group_ids.includes(g.id)}
                    onChange={() => setForm({ ...form, modifier_group_ids: toggleIn(form.modifier_group_ids, g.id) })}
                  />
                  {content.t(g.name)}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {save.error && <p className="text-sm text-red-600">{errorText(save.error)}</p>}
        <div className="flex justify-between gap-2">
          {item ? (
            <button
              type="button"
              className={btn.danger}
              onClick={() =>
                confirm(t('common.confirmDelete', { name: content.t(item.name) })) && remove.mutate(item.id, { onSuccess: onClose })
              }
            >
              <Trash2 className="size-4" /> {t('common.delete')}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className={btn.primary} disabled={save.isPending || !pricesValid}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
