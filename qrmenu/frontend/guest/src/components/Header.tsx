import { useContext, useState } from 'react'

import { tr } from '../../../shared/localized'
import { LangContext, useT } from '../i18n'
import type { GuestMenu } from '../types'
import { ChevronLeftIcon, SearchIcon, XIcon } from './icons'
import LanguagePill from './LanguagePill'

export default function Header({
  restaurant,
  tableNumber,
  query,
  onQuery,
  onBack,
}: {
  restaurant: GuestMenu['restaurant']
  tableNumber: string | null
  query: string
  onQuery: (q: string) => void
  onBack: () => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const [searching, setSearching] = useState(false)
  const name = tr(restaurant.name, lang, restaurant.default_language)
  const round = 'flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-paper'

  return (
    <div className="flex h-16 items-center gap-2 px-4">
      {searching ? (
        <label className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-5 text-muted" />
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            placeholder={t('search')}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            className="w-full rounded-full border border-line bg-paper py-2 pr-4 pl-10 text-base outline-none focus:ring-2 focus:ring-wine/20"
          />
        </label>
      ) : (
        <>
          <button aria-label={t('back')} onClick={onBack} className={round} data-testid="back-home">
            <ChevronLeftIcon className="size-5" />
          </button>
          <div className="min-w-0 flex-1 pl-1">
            <div className="truncate font-serif text-lg leading-tight font-bold">{name}</div>
            {tableNumber && <div className="text-sm text-muted">{t('table', { number: tableNumber })}</div>}
          </div>
        </>
      )}
      <button
        aria-label={searching ? t('close') : t('search')}
        onClick={() => {
          if (searching) onQuery('')
          setSearching(!searching)
        }}
        className={round}
      >
        {searching ? <XIcon className="size-5" /> : <SearchIcon className="size-5" />}
      </button>
      <LanguagePill languages={restaurant.languages} tone="light" />
    </div>
  )
}
