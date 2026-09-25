import { useContext, useState } from 'react'

import { tr } from '../../../shared/localized'
import { LangContext, useT } from '../i18n'
import type { GuestMenu } from '../types'
import { SearchIcon, XIcon } from './icons'

export default function Header({
  restaurant,
  tableNumber,
  query,
  onQuery,
}: {
  restaurant: GuestMenu['restaurant']
  tableNumber: string | null
  query: string
  onQuery: (q: string) => void
}) {
  const t = useT()
  const { lang, setLang } = useContext(LangContext)
  const [searching, setSearching] = useState(false)
  const name = tr(restaurant.name, lang, restaurant.default_language)

  return (
    <div className="flex h-16 items-center gap-3 px-4">
      {searching ? (
        <label className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-5 text-slate-400" />
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            placeholder={t('search')}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            className="w-full rounded-full bg-slate-100 py-2 pr-4 pl-10 text-base outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
      ) : (
        <>
          {restaurant.logo_urls && <img src={restaurant.logo_urls.w400} alt="" className="size-10 rounded-full object-cover" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg leading-tight font-bold">{name}</div>
            {tableNumber && <div className="text-sm text-slate-500">{t('table', { number: tableNumber })}</div>}
          </div>
        </>
      )}
      <button
        aria-label={searching ? t('close') : t('search')}
        onClick={() => {
          if (searching) onQuery('')
          setSearching(!searching)
        }}
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200"
      >
        {searching ? <XIcon className="size-5" /> : <SearchIcon className="size-5" />}
      </button>
      {restaurant.languages.length > 1 && (
        <select
          aria-label={t('language')}
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="h-10 shrink-0 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium uppercase"
        >
          {restaurant.languages.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
