import { useContext } from 'react'

import { tr } from '../../../shared/localized'
import { formatMoney } from '../../../shared/money'
import { LangContext, useT } from '../i18n'
import type { GuestItem } from '../types'
import Img from './Img'

export default function ItemCard({
  item,
  currency,
  fallbackLang,
  onOpen,
}: {
  item: GuestItem
  currency: string
  fallbackLang: string
  onOpen: () => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const price = item.prices.find((p) => p.is_default) ?? item.prices[0]
  const hasVariants = item.prices.length > 1

  return (
    <button
      onClick={onOpen}
      data-testid="guest-item"
      className={`flex w-full gap-4 border-b border-slate-100 py-4 text-left last:border-0 ${item.is_available ? '' : 'opacity-50'}`}
    >
      <Img src={item.image_urls?.w400} className="size-28 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{tr(item.name, lang, fallbackLang)}</div>
        {item.badges.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.badges.map((b) => (
              <span key={b} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                {t(`badge.${b}`)}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{tr(item.description, lang, fallbackLang)}</p>
        <div className="mt-2 font-semibold">
          {item.is_available ? (
            hasVariants ? (
              t('priceFrom', { price: formatMoney(Math.min(...item.prices.map((p) => p.amount)), currency, lang) })
            ) : (
              formatMoney(price.amount, currency, lang)
            )
          ) : (
            <span className="text-sm font-medium text-slate-500">{t('outOfStock')}</span>
          )}
        </div>
      </div>
    </button>
  )
}
