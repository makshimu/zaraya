import { Clock, ImageIcon, Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMenu, usePatchCategory, usePatchItem, useReorder } from '../../api/menu'
import type { Category, Item, ModifierGroup } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { DragHandle, SortableItem, SortableList } from '../../components/Sortable'
import Toggle from '../../components/Toggle'
import { btn, input } from '../../components/ui'
import { formatMoney } from '../../../../shared/money'
import CategoryModal from './CategoryModal'
import GroupModal from './GroupModal'
import ItemModal from './ItemModal'
import { useContentLocale } from './shared'

type Editing =
  | { kind: 'category'; category: Category | null }
  | { kind: 'item'; item: Item | null; categoryId: number }
  | { kind: 'group'; group: ModifierGroup | null }

export default function MenuPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const menu = useMenu()
  const reorder = useReorder()
  const [tab, setTab] = useState<'menu' | 'groups'>('menu')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)

  const data = menu.data
  const q = query.trim().toLowerCase()
  const matches = (item: Item) =>
    !q || [...Object.values(item.name), ...Object.values(item.description)].some((s) => s.toLowerCase().includes(q))

  const itemsByCategory = useMemo(() => {
    const map = new Map<number, Item[]>()
    for (const item of data?.items ?? []) map.set(item.category_id, [...(map.get(item.category_id) ?? []), item])
    return map
  }, [data])
  const groupsById = useMemo(() => new Map((data?.modifier_groups ?? []).map((g) => [g.id, g])), [data])

  if (menu.isLoading || !data) return <p className="text-slate-500">{t('common.loading')}</p>

  const visibleCategories = data.categories.filter((c) => !q || (itemsByCategory.get(c.id) ?? []).some(matches))
  // Reordering while filtered would hide rows from the new order, so it's off during search
  const canSort = isAdmin && !q

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-3xl font-semibold">{t('menu.title')}</h1>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(['menu', 'groups'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t(key === 'menu' ? 'menu.tabMenu' : 'menu.modifierGroups')}
          </button>
        ))}
      </div>

      {tab === 'menu' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
              <input
                type="search"
                className={`${input} pl-9`}
                placeholder={t('menu.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {isAdmin && (
              <button className={btn.primary} onClick={() => setEditing({ kind: 'category', category: null })}>
                <Plus className="size-4" /> {t('menu.addCategory')}
              </button>
            )}
          </div>

          {data.categories.length === 0 && <Empty text={t('menu.emptyMenu')} />}
          {q && visibleCategories.length === 0 && <Empty text={t('menu.nothingFound')} />}

          <div className="rounded-2xl border border-slate-200 bg-white">
            <SortableList
              ids={visibleCategories.map((c) => c.id)}
              disabled={!canSort}
              onReorder={(ids) => reorder.mutate({ scope: { kind: 'categories' }, ids })}
            >
              {visibleCategories.map((category) => (
                <SortableItem key={category.id} id={category.id} className="border-b border-slate-100 bg-white last:border-0">
                  <CategoryBlock
                    category={category}
                    items={(itemsByCategory.get(category.id) ?? []).filter(matches)}
                    groupsById={groupsById}
                    isAdmin={isAdmin}
                    canSort={canSort}
                    onEdit={setEditing}
                  />
                </SortableItem>
              ))}
            </SortableList>
          </div>
        </>
      ) : (
        <GroupsTab groups={data.modifier_groups} isAdmin={isAdmin} onEdit={(group) => setEditing({ kind: 'group', group })} />
      )}

      {editing?.kind === 'category' && <CategoryModal category={editing.category} onClose={() => setEditing(null)} />}
      {editing?.kind === 'item' && (
        <ItemModal
          item={editing.item}
          categoryId={editing.categoryId}
          categories={data.categories}
          groups={data.modifier_groups}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'group' && <GroupModal group={editing.group} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="mb-4 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">{text}</div>
}

function Thumb({ url }: { url: string | undefined }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <ImageIcon className="size-5 text-slate-300" />}
    </div>
  )
}

function CategoryBlock({
  category,
  items,
  groupsById,
  isAdmin,
  canSort,
  onEdit,
}: {
  category: Category
  items: Item[]
  groupsById: Map<number, ModifierGroup>
  isAdmin: boolean
  canSort: boolean
  onEdit: (e: Editing) => void
}) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const patch = usePatchCategory()
  const reorder = useReorder()

  return (
    <div className="p-4" data-testid="category">
      <div className="flex items-center gap-3">
        <DragHandle label={t('menu.drag')} />
        <Thumb url={category.image_urls?.w400} />
        <div className="min-w-0 flex-1">
          <h2 className={`truncate text-lg font-semibold ${category.is_enabled ? '' : 'text-slate-400'}`}>{content.t(category.name)}</h2>
          {category.available_from && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="size-3.5" /> {category.available_from.slice(0, 5)}–{category.available_to?.slice(0, 5)}
            </div>
          )}
        </div>
        <Status enabled={category.is_enabled} />
        {isAdmin && (
          <>
            <Toggle
              checked={category.is_enabled}
              label={t('menu.enabled')}
              onChange={(is_enabled) => patch.mutate({ id: category.id, is_enabled })}
            />
            <button className={btn.icon} onClick={() => onEdit({ kind: 'category', category })} aria-label={t('common.edit')}>
              <Pencil className="size-4" />
            </button>
          </>
        )}
      </div>

      <div className="mt-3 space-y-2 pl-8">
        <SortableList
          ids={items.map((i) => i.id)}
          disabled={!canSort}
          onReorder={(ids) => reorder.mutate({ scope: { kind: 'items', categoryId: category.id }, ids })}
        >
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id} className="rounded-xl bg-white">
              <ItemRow item={item} groupsById={groupsById} isAdmin={isAdmin} onEdit={onEdit} />
            </SortableItem>
          ))}
        </SortableList>
        {isAdmin && (
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
            onClick={() => onEdit({ kind: 'item', item: null, categoryId: category.id })}
          >
            <Plus className="size-4" /> {t('menu.addItem')}
          </button>
        )}
      </div>
    </div>
  )
}

function Status({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()
  return (
    <span className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
      <span className={`size-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
      {t(enabled ? 'menu.enabled' : 'menu.disabled')}
    </span>
  )
}

function ItemRow({
  item,
  groupsById,
  isAdmin,
  onEdit,
}: {
  item: Item
  groupsById: Map<number, ModifierGroup>
  isAdmin: boolean
  onEdit: (e: Editing) => void
}) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const patch = usePatchItem()

  return (
    <div className="flex items-start gap-3 py-2" data-testid="item">
      <DragHandle label={t('menu.drag')} />
      <Thumb url={item.image_urls?.w400} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${item.is_enabled ? '' : 'text-slate-400'}`}>{content.t(item.name)}</span>
          {!item.is_available && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{t('menu.outOfStock')}</span>
          )}
          {item.badges.map((b) => (
            <span key={b} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {t(`badges.${b}`)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {item.prices.map((p) => (
            <span key={p.id} className="rounded-lg bg-violet-600 px-3 py-1 text-sm text-white">
              {formatMoney(p.amount, content.currency, content.lang)}
              {content.t(p.name) && ` · ${content.t(p.name)}`}
              {p.is_default && item.prices.length > 1 && ` (${t('menu.default')})`}
            </span>
          ))}
        </div>
        {item.modifier_group_ids.length > 0 && (
          <div className="text-sm text-slate-500">
            {t('menu.modifierGroups')}:{' '}
            {item.modifier_group_ids.map((id) => content.t(groupsById.get(id)?.name)).join(', ')}
          </div>
        )}
      </div>
      <Status enabled={item.is_enabled} />
      {isAdmin && (
        <>
          <Toggle checked={item.is_enabled} label={t('menu.enabled')} onChange={(is_enabled) => patch.mutate({ id: item.id, is_enabled })} />
          <button
            className={btn.icon}
            onClick={() => onEdit({ kind: 'item', item, categoryId: item.category_id })}
            aria-label={t('common.edit')}
          >
            <Pencil className="size-4" />
          </button>
        </>
      )}
    </div>
  )
}

function GroupsTab({
  groups,
  isAdmin,
  onEdit,
}: {
  groups: ModifierGroup[]
  isAdmin: boolean
  onEdit: (group: ModifierGroup | null) => void
}) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const reorder = useReorder()

  return (
    <>
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <button className={btn.primary} onClick={() => onEdit(null)}>
            <Plus className="size-4" /> {t('menu.addGroup')}
          </button>
        </div>
      )}
      {groups.length === 0 && <Empty text={t('menu.noGroupsYet')} />}
      <div className="space-y-2">
        <SortableList ids={groups.map((g) => g.id)} disabled={!isAdmin} onReorder={(ids) => reorder.mutate({ scope: { kind: 'groups' }, ids })}>
          {groups.map((g) => (
            <SortableItem key={g.id} id={g.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start gap-3 p-4" data-testid="group">
                <DragHandle label={t('menu.drag')} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{content.t(g.name)}</div>
                  <div className="text-sm text-slate-500">
                    {g.is_required ? t('menu.required') : t('menu.optional')} ·{' '}
                    {t('menu.selectRange', { min: g.min_select, max: g.max_select })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {g.modifiers.map((m) => (
                      <span
                        key={m.id}
                        className={`rounded-lg px-2.5 py-1 text-sm ${m.is_available ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400 line-through'}`}
                      >
                        {content.t(m.name)}
                        {m.price > 0 && ` +${formatMoney(m.price, content.currency, content.lang)}`}
                      </span>
                    ))}
                  </div>
                </div>
                {isAdmin && (
                  <button className={btn.icon} onClick={() => onEdit(g)} aria-label={t('common.edit')}>
                    <Pencil className="size-4" />
                  </button>
                )}
              </div>
            </SortableItem>
          ))}
        </SortableList>
      </div>
    </>
  )
}
