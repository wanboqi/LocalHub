import { useState } from 'react'
import Modal from './Modal'
import { CATEGORY_ICON_CHOICES, normalizeUrl, urlHost } from '../store'
import type { Category, Item, SubCategory } from '../types'

/* ---------- 分类新建 / 编辑 ---------- */

interface CategoryDialogProps {
  category: Category | null
  onCancel: () => void
  onSave: (name: string, icon: string) => void
}

export function CategoryDialog({ category, onCancel, onSave }: CategoryDialogProps) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICON_CHOICES[0])

  const submit = () => {
    const t = name.trim()
    if (!t) return
    onSave(t, icon)
  }

  return (
    <Modal
      title={category ? '编辑分类' : '新建分类'}
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn primary" onClick={submit} disabled={!name.trim()}>
            保存
          </button>
        </>
      }
    >
      <label className="field">
        <span>分类名称</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="例如：开发工具"
          maxLength={20}
        />
      </label>

      <div className="field">
        <span>图标</span>
        <div className="emoji-grid">
          {CATEGORY_ICON_CHOICES.map((e) => (
            <button
              key={e}
              className={`emoji ${icon === e ? 'on' : ''}`}
              onClick={() => setIcon(e)}
              type="button"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/* ---------- 子栏目新建 / 重命名 ---------- */

interface SubDialogProps {
  sub: SubCategory | null
  categoryName: string
  onCancel: () => void
  onSave: (name: string) => void
}

export function SubDialog({ sub, categoryName, onCancel, onSave }: SubDialogProps) {
  const [name, setName] = useState(sub?.name ?? '')

  const submit = () => {
    const t = name.trim()
    if (!t) return
    onSave(t)
  }

  return (
    <Modal
      title={sub ? '重命名子栏目' : `在「${categoryName}」下新建子栏目`}
      onClose={onCancel}
      width={380}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn primary" onClick={submit} disabled={!name.trim()}>
            保存
          </button>
        </>
      }
    >
      <label className="field">
        <span>子栏目名称</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="例如：AI软件 / 影音"
          maxLength={20}
        />
      </label>
      <p className="hint">子栏目只是分组，条目仍然属于「{categoryName}」这个分类。</p>
    </Modal>
  )
}

/* ---------- 新增网址 ---------- */

interface UrlDialogProps {
  categoryName: string
  subs: SubCategory[]
  subId: string | undefined
  onCancel: () => void
  onSave: (name: string, url: string, note: string, subId: string | undefined, keepOpen: boolean) => void
}

export function UrlDialog({ categoryName, subs, subId, onCancel, onSave }: UrlDialogProps) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [sub, setSub] = useState(subId ?? '')

  const normalized = normalizeUrl(url)
  const bad = url.trim().length > 0 && !normalized
  const ready = normalized.length > 0

  const submit = (keepOpen: boolean) => {
    if (!ready) return
    const host = urlHost(normalized)
    onSave(name.trim() || host || normalized, normalized, note.trim(), sub || undefined, keepOpen)
    if (keepOpen) {
      setUrl('')
      setName('')
      setNote('')
    }
  }

  return (
    <Modal
      title={`添加到「${categoryName}」`}
      onClose={onCancel}
      width={430}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn" onClick={() => submit(true)} disabled={!ready}>
            保存并继续
          </button>
          <button className="btn primary" onClick={() => submit(false)} disabled={!ready}>
            保存
          </button>
        </>
      }
    >
      <label className="field">
        <span>网址</span>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(false)}
          placeholder="github.com 或 https://…"
        />
      </label>

      {bad ? <p className="field-error">这不像一个可用的网址，请检查后重试</p> : null}
      {ready ? <p className="field-ok">✓ {normalized}</p> : null}

      <label className="field">
        <span>显示名称（留空用域名）</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(false)}
          placeholder={urlHost(normalized) || '例如：GitHub'}
          maxLength={80}
        />
      </label>

      <label className="field">
        <span>备注（可选）</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(false)}
          placeholder="用途说明…"
          maxLength={120}
        />
      </label>

      <label className="field">
        <span>所属子栏目</span>
        <select
          className="select wide"
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          disabled={subs.length === 0}
        >
          <option value="">{subs.length === 0 ? '该栏目暂无子栏目' : '不指定（未分组）'}</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  )
}

/* ---------- 条目编辑：重命名 / 备注 / 归类 ---------- */

interface ItemEditDialogProps {
  item: Item
  categories: Category[]
  subs: SubCategory[]
  onCancel: () => void
  onSave: (patch: Pick<Item, 'name' | 'note' | 'categoryId' | 'subId' | 'path'>) => void
}

export function ItemEditDialog({ item, categories, subs, onCancel, onSave }: ItemEditDialogProps) {
  const isUrl = item.kind === 'url'
  const [name, setName] = useState(item.name)
  const [note, setNote] = useState(item.note ?? '')
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [subId, setSubId] = useState(item.subId ?? '')
  const [url, setUrl] = useState(isUrl ? item.path : '')

  const catSubs = subs.filter((s) => s.categoryId === categoryId)
  const normalized = isUrl ? normalizeUrl(url) : ''
  const badUrl = isUrl && url.trim().length > 0 && !normalized

  const submit = () => {
    const t = name.trim()
    if (!t) return
    if (isUrl && !normalized) return
    onSave({
      name: t,
      note: note.trim(),
      categoryId,
      subId: catSubs.some((s) => s.id === subId) ? subId : undefined,
      path: isUrl ? normalized : item.path,
    })
  }

  return (
    <Modal
      title="编辑条目"
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={!name.trim() || (isUrl && !normalized)}
          >
            保存
          </button>
        </>
      }
    >
      <label className="field">
        <span>显示名称</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={80}
        />
      </label>

      <label className="field">
        <span>备注</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="用途说明、版本号…"
          maxLength={120}
        />
      </label>

      {isUrl ? (
        <label className="field">
          <span>网址</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="https://…"
          />
          {badUrl ? <span className="field-error">网址格式不可用</span> : null}
        </label>
      ) : null}

      <label className="field">
        <span>所属分类</span>
        <select
          className="select wide"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setSubId('')
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>所属子栏目</span>
        <select
          className="select wide"
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          disabled={catSubs.length === 0}
        >
          <option value="">{catSubs.length === 0 ? '该分类暂无子栏目' : '不指定（分类下未分组）'}</option>
          {catSubs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {isUrl ? null : (
        <div className="path-preview" title={item.path}>
          {item.path}
        </div>
      )}
    </Modal>
  )
}

/* ---------- 通用确认框 ---------- */

interface ConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmText = '确定',
  danger = true,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={400}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </>
      }
    >
      <p className="confirm-text">{message}</p>
    </Modal>
  )
}

/* ---------- 拖入时选择目标分类 / 子栏目 ---------- */

interface PickCategoryDialogProps {
  paths: string[]
  categories: Category[]
  subs: SubCategory[]
  onCancel: () => void
  onPick: (categoryId: string, subId?: string) => void
}

export function PickCategoryDialog({ paths, categories, subs, onCancel, onPick }: PickCategoryDialogProps) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [subId, setSubId] = useState('')
  const catSubs = subs.filter((s) => s.categoryId === categoryId)

  return (
    <Modal
      title="添加到哪个分类？"
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => onPick(categoryId, subId || undefined)}
            disabled={!categoryId}
          >
            添加 {paths.length} 项
          </button>
        </>
      }
    >
      <div className="drop-list">
        {paths.slice(0, 4).map((p) => (
          <div key={p} className="drop-item" title={p}>
            {p}
          </div>
        ))}
        {paths.length > 4 ? <div className="drop-item muted">…还有 {paths.length - 4} 项</div> : null}
      </div>

      <div className="cat-pick">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`cat-pick-item ${categoryId === c.id ? 'on' : ''}`}
            onClick={() => {
              setCategoryId(c.id)
              setSubId('')
            }}
          >
            <span className="cat-pick-icon">{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      <label className="field">
        <span>子栏目（可选）</span>
        <select
          className="select wide"
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          disabled={catSubs.length === 0}
        >
          <option value="">{catSubs.length === 0 ? '该分类暂无子栏目' : '不指定（分类下未分组）'}</option>
          {catSubs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  )
}
