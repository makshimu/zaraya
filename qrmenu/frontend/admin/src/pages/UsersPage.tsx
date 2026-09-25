import { Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { Role } from '../api/types'
import { useSaveUser, useUsers, type StaffUser } from '../api/users'
import { useAuth } from '../auth/AuthContext'
import Modal from '../components/Modal'
import { btn, input, label } from '../components/ui'
import { useErrorText } from './menu/shared'

export default function UsersPage() {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const users = useUsers()
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t('users.title')}</h1>
        <button className={btn.primary} onClick={() => setEditing('new')}>
          <Plus className="size-4" /> {t('users.add')}
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-500">{t('users.hint')}</p>

      {users.isLoading && <p className="text-slate-500">{t('common.loading')}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t('users.name')}</th>
              <th className="px-4 py-3 font-medium">{t('users.email')}</th>
              <th className="px-4 py-3 font-medium">{t('users.role')}</th>
              <th className="px-4 py-3 font-medium">{t('users.status')}</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0" data-testid="user-row">
                <td className="px-4 py-3 font-medium">
                  {u.name || '—'}
                  {u.id === me?.id && <span className="ml-2 text-xs text-slate-400">{t('users.you')}</span>}
                </td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{t(`roles.${u.role}`)}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-2 ${u.is_active ? '' : 'text-slate-400'}`}>
                    <span className={`size-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                    {t(u.is_active ? 'users.active' : 'users.blocked')}
                  </span>
                </td>
                <td className="px-2">
                  <button className={btn.icon} aria-label={t('common.edit')} onClick={() => setEditing(u)}>
                    <Pencil className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <UserModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function UserModal({ user, onClose }: { user: StaffUser | null; onClose: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveUser()
  const [email, setEmail] = useState(user?.email ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'waiter')
  const [active, setActive] = useState(user?.is_active ?? true)
  const [password, setPassword] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const data = user
      ? { name, role, is_active: active, ...(password ? { password } : {}) }
      : { email, name, role, password }
    save.mutate({ id: user?.id, data }, { onSuccess: onClose })
  }

  return (
    <Modal title={user ? user.name || user.email : t('users.add')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!user && (
          <div>
            <label className={label} htmlFor="u-email">
              {t('users.email')}
            </label>
            <input
              id="u-email"
              type="email"
              required
              className={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className={label} htmlFor="u-name">
            {t('users.name')}
          </label>
          <input id="u-name" className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="u-role">
            {t('users.role')}
          </label>
          <select id="u-role" className={input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="waiter">{t('roles.waiter')}</option>
            <option value="admin">{t('roles.admin')}</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">{t(`users.roleHint.${role}`)}</p>
        </div>
        <div>
          <label className={label} htmlFor="u-password">
            {user ? t('users.newPassword') : t('users.password')}
          </label>
          <input
            id="u-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required={!user}
            className={input}
            value={password}
            placeholder={user ? t('users.keepPassword') : ''}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {user && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('users.canSignIn')}
          </label>
        )}
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
