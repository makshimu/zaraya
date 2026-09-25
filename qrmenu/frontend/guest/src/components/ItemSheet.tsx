import { useContext, useEffect, useState } from 'react'

import { tr } from '../../../shared/localized'
import { formatMoney } from '../../../shared/money'
import { LangContext, useT } from '../i18n'
import { groupSatisfied, initialSelection, toggleModifier, unitPrice } from '../selection'
import type { GuestItem, GuestModifierGroup } from '../types'
import { MinusIcon, PlusIcon, XIcon } from './icons'
import Img from './Img'

/** Dish screen: big photo, description, price variant and modifiers, live total. */
export default function ItemSheet({
  item,
  groups,
  currency,
  fallbackLang,
  onClose,
}: {
  item: GuestItem
  groups: GuestModifierGroup[]
  currency: string
  fallbackLang: string
  onClose: () => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const l = (v: Record<string, string>) => tr(v, lang, fallbackLang)
  const [sel, setSel] = useState(() => initialSelection(item))
  const money = (amount: number) => formatMoney(amount, currency, lang)

  // Lock page scroll behind the sheet; close on Escape / browser back
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    history.pushState({ sheet: true }, '')
    // Only a real back navigation closes the sheet (StrictMode re-runs effects in dev)
    const onPop = () => !history.state?.sheet && onClose()
    window.addEventListener('popstate', onPop)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      if (history.state?.sheet) history.back()
    }
  }, [onClose])

  const total = unitPrice(item, groups, sel) * sel.quantity

  function groupHint(g: GuestModifierGroup) {
    const range =
      g.min_select === g.max_select && g.min_select > 0
        ? t('pickExactly', { n: g.min_select })
        : g.min_select > 0
          ? t('pickRange', { min: g.min_select, max: g.max_select })
          : t('pickUpTo', { max: g.max_select })
    return g.is_required ? `${t('required')} · ${range}` : range
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={l(item.name)}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-y-auto">
          {item.image_urls && <Img src={item.image_urls.w1200} eager className="aspect-[4/3] w-full" />}
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 shadow"
          >
            <XIcon className="size-5" />
          </button>

          <div className="space-y-5 p-5">
            <div>
              <h2 className="text-2xl font-bold">{l(item.name)}</h2>
              {item.badges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.badges.map((b) => (
                    <span key={b} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                      {t(`badge.${b}`)}
                    </span>
                  ))}
                </div>
              )}
              {l(item.description) && <p className="mt-2 text-slate-600">{l(item.description)}</p>}
              {!item.is_available && <p className="mt-2 font-medium text-amber-700">{t('outOfStock')}</p>}
            </div>

            {item.prices.length > 1 && (
              <fieldset className="space-y-2">
                {item.prices.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 has-checked:border-blue-500 has-checked:bg-blue-50">
                    <input
                      type="radio"
                      name="variant"
                      className="size-4 accent-blue-600"
                      checked={sel.priceId === p.id}
                      onChange={() => setSel({ ...sel, priceId: p.id })}
                    />
                    <span className="flex-1">{l(p.name) || money(p.amount)}</span>
                    <span className="font-medium">{money(p.amount)}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {groups.map((g) => (
              <fieldset key={g.id} className="space-y-2">
                <legend className="mb-2 flex w-full items-baseline justify-between">
                  <span className="font-semibold">{l(g.name)}</span>
                  <span className={`text-xs ${groupSatisfied(sel, g) ? 'text-slate-500' : 'text-red-600'}`}>{groupHint(g)}</span>
                </legend>
                {g.modifiers.map((m) => {
                  const checked = (sel.modifierIds[g.id] ?? []).includes(m.id)
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 has-checked:border-blue-500 has-checked:bg-blue-50 ${m.is_available ? '' : 'opacity-50'}`}
                    >
                      <input
                        type={g.max_select === 1 ? 'radio' : 'checkbox'}
                        name={`group-${g.id}`}
                        className="size-4 accent-blue-600"
                        disabled={!m.is_available}
                        checked={checked}
                        onClick={() => setSel(toggleModifier(sel, g, m.id))}
                        onChange={() => {}}
                      />
                      <span className="flex-1">
                        {l(m.name)}
                        {!m.is_available && <span className="ml-2 text-xs text-slate-500">{t('outOfStock')}</span>}
                      </span>
                      {m.price > 0 && <span className="text-slate-600">+{money(m.price)}</span>}
                    </label>
                  )
                })}
              </fieldset>
            ))}

            <div className="flex items-center justify-between">
              <span className="font-semibold">{t('quantity')}</span>
              <div className="flex items-center gap-4">
                <button
                  aria-label={t('decrease')}
                  disabled={sel.quantity <= 1}
                  onClick={() => setSel({ ...sel, quantity: sel.quantity - 1 })}
                  className="flex size-10 items-center justify-center rounded-full border border-slate-200 disabled:opacity-30"
                >
                  <MinusIcon className="size-5" />
                </button>
                <span className="w-6 text-center text-lg font-semibold" data-testid="qty">
                  {sel.quantity}
                </span>
                <button
                  aria-label={t('increase')}
                  onClick={() => setSel({ ...sel, quantity: Math.min(99, sel.quantity + 1) })}
                  className="flex size-10 items-center justify-center rounded-full border border-slate-200"
                >
                  <PlusIcon className="size-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>{t('total')}</span>
            <span data-testid="total">{money(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
