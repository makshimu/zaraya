import { Check, Copy, Download, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../api/client'
import {
  downloadQr,
  useDeleteHall,
  useDeleteTable,
  useHalls,
  useQrImage,
  useRegenerateToken,
  useSaveHall,
  useSaveTable,
  useTables,
} from '../api/tables'
import type { Hall, Table, TableInput } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import Modal from '../components/Modal'
import { btn, input, label } from '../components/ui'

function useErrorText() {
  const { t } = useTranslation()
  return (err: unknown) => t(`errors.${err instanceof ApiError ? err.code : 'unknown_error'}`, t('errors.unknown_error'))
}

export default function TablesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const halls = useHalls()
  const tables = useTables()
  const deleteHall = useDeleteHall()

  const [hallEditing, setHallEditing] = useState<Hall | 'new' | null>(null)
  const [tableEditing, setTableEditing] = useState<Table | 'new' | null>(null)

  if (halls.isLoading || tables.isLoading) return <p className="text-slate-500">{t('common.loading')}</p>

  const groups: { hall: Hall | null; tables: Table[] }[] = [
    ...(halls.data ?? []).map((hall) => ({ hall, tables: (tables.data ?? []).filter((x) => x.hall_id === hall.id) })),
    { hall: null, tables: (tables.data ?? []).filter((x) => x.hall_id === null) },
  ].filter((g) => g.hall !== null || g.tables.length > 0)

  // Keep the modal in sync with fresh data after a save/regenerate
  const editingTable =
    tableEditing === 'new' ? 'new' : tableEditing && (tables.data?.find((x) => x.id === tableEditing.id) ?? null)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t('tables.title')}</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button className={btn.secondary} onClick={() => setHallEditing('new')}>
              <Plus className="size-4" /> {t('tables.addHall')}
            </button>
            <button className={btn.primary} onClick={() => setTableEditing('new')}>
              <Plus className="size-4" /> {t('tables.addTable')}
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          {t('tables.empty')}
        </div>
      )}

      <div className="space-y-6">
        {groups.map(({ hall, tables: list }) => (
          <section key={hall?.id ?? 'none'} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold">{hall?.name ?? t('tables.noHall')}</h2>
              {isAdmin && hall && (
                <>
                  <button className={btn.icon} onClick={() => setHallEditing(hall)} aria-label={t('common.edit')}>
                    <Pencil className="size-4" />
                  </button>
                  <button
                    className={btn.icon}
                    aria-label={t('common.delete')}
                    onClick={() => confirm(t('common.confirmDelete', { name: hall.name })) && deleteHall.mutate(hall.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
              {list.map((table) => (
                <TableCard key={table.id} table={table} onClick={() => setTableEditing(table)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {hallEditing && (
        <HallModal hall={hallEditing === 'new' ? null : hallEditing} onClose={() => setHallEditing(null)} />
      )}
      {editingTable && (
        <TableModal
          table={editingTable === 'new' ? null : editingTable}
          halls={halls.data ?? []}
          readOnly={!isAdmin}
          onClose={() => setTableEditing(null)}
          onCreated={(created) => setTableEditing(created)}
        />
      )}
    </div>
  )
}

function TableCard({ table, onClick }: { table: Table; onClick: () => void }) {
  const { t } = useTranslation()
  const qr = useQrImage(table)
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:shadow-sm"
    >
      <div className="aspect-square w-full rounded-lg bg-slate-50">
        {qr && <img src={qr} alt="" className="size-full object-contain" />}
      </div>
      <div className="flex w-full items-center justify-between">
        <span className="text-lg font-semibold">{table.number}</span>
        <span className={`size-2.5 rounded-full ${table.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
      </div>
      <div className="flex w-full items-center gap-1 text-xs text-slate-500">
        <Users className="size-3.5" /> {t('tables.seats', { count: table.capacity })}
      </div>
    </button>
  )
}

function HallModal({ hall, onClose }: { hall: Hall | null; onClose: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveHall()
  const [name, setName] = useState(hall?.name ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate({ id: hall?.id, name }, { onSuccess: onClose })
  }

  return (
    <Modal title={hall ? hall.name : t('tables.addHall')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={label} htmlFor="hall-name">
            {t('tables.hallName')}
          </label>
          <input id="hall-name" className={input} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        {save.error && <p className="text-sm text-red-600">{errorText(save.error)}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TableModal({
  table,
  halls,
  readOnly,
  onClose,
  onCreated,
}: {
  table: Table | null
  halls: Hall[]
  readOnly: boolean
  onClose: () => void
  onCreated: (t: Table) => void
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveTable()
  const remove = useDeleteTable()
  const [form, setForm] = useState<TableInput>({
    number: table?.number ?? '',
    hall_id: table?.hall_id ?? halls[0]?.id ?? null,
    capacity: table?.capacity ?? 4,
    is_active: table?.is_active ?? true,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      { id: table?.id, data: form },
      { onSuccess: (saved) => (table ? onClose() : onCreated(saved)) },
    )
  }

  return (
    <Modal title={table ? t('tables.editTable', { number: table.number }) : t('tables.newTable')} onClose={onClose} wide={!!table}>
      <div className={table ? 'grid gap-6 md:grid-cols-2' : ''}>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={readOnly} className="space-y-4">
            <div>
              <label className={label} htmlFor="t-number">
                {t('tables.number')}
              </label>
              <input
                id="t-number"
                className={input}
                required
                maxLength={32}
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className={label} htmlFor="t-hall">
                {t('tables.hall')}
              </label>
              <select
                id="t-hall"
                className={input}
                value={form.hall_id ?? ''}
                onChange={(e) => setForm({ ...form, hall_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{t('tables.noHall')}</option>
                {halls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="t-cap">
                {t('tables.capacity')}
              </label>
              <input
                id="t-cap"
                type="number"
                min={1}
                max={100}
                className={input}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              {t('tables.active')}
            </label>
          </fieldset>
          {save.error && <p className="text-sm text-red-600">{errorText(save.error)}</p>}
          {!readOnly && (
            <div className="flex flex-wrap justify-between gap-2">
              {table ? (
                <button
                  type="button"
                  className={btn.danger}
                  onClick={() =>
                    confirm(t('common.confirmDelete', { name: table.number })) &&
                    remove.mutate(table.id, { onSuccess: onClose })
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
          )}
        </form>
        {table && <QrPanel table={table} readOnly={readOnly} />}
      </div>
    </Modal>
  )
}

function QrPanel({ table, readOnly }: { table: Table; readOnly: boolean }) {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const qr = useQrImage(table)
  const regenerate = useRegenerateToken()
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(table.qr_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-slate-700">{t('tables.qr')}</div>
      <div className="aspect-square w-full max-w-64 rounded-xl border border-slate-200 bg-white">
        {qr && <img src={qr} alt={`QR ${table.number}`} className="size-full object-contain" />}
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs" title={table.qr_url}>
          {table.qr_url}
        </code>
        <button className={btn.icon} onClick={copy} aria-label={t('tables.copyLink')} title={t('tables.copyLink')}>
          {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
        </button>
      </div>
      <div className="text-xs text-slate-500">
        {t('tables.issuedAt', { date: new Date(table.token_issued_at).toLocaleString(i18n.language) })}
      </div>
      {!readOnly && (
        <>
          <div className="flex gap-2">
            <button className={btn.secondary} onClick={() => downloadQr(table, 'png')}>
              <Download className="size-4" /> {t('tables.downloadPng')}
            </button>
            <button className={btn.secondary} onClick={() => downloadQr(table, 'svg')}>
              <Download className="size-4" /> {t('tables.downloadSvg')}
            </button>
          </div>
          <button
            className={btn.danger}
            disabled={regenerate.isPending}
            onClick={() => confirm(t('tables.regenerateConfirm', { number: table.number })) && regenerate.mutate(table.id)}
          >
            <RefreshCw className="size-4" /> {t('tables.regenerate')}
          </button>
          {regenerate.error && <p className="text-sm text-red-600">{errorText(regenerate.error)}</p>}
        </>
      )}
    </div>
  )
}
