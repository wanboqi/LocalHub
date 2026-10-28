import type { RefObject } from 'react'
import type { SortMode } from '../types'

const SORT_LABELS: Record<SortMode, string> = {
  'added-desc': '最近添加',
  'added-asc': '最早添加',
  'name-asc': '名称 A→Z',
  'name-desc': '名称 Z→A',
}

/** all = 全部视图（按钮全显示），file = 文件类栏目，url = 网址栏目 */
export type ToolbarMode = 'all' | 'file' | 'url'

interface ToolbarProps {
  query: string
  onQuery: (v: string) => void
  inputRef?: RefObject<HTMLInputElement | null>
  sort: SortMode
  onSort: (v: SortMode) => void
  mode: ToolbarMode
  onAddFile: () => void
  onAddFolder: () => void
  onAddUrl: () => void
  onRefresh: () => void
  checking: boolean
}

export default function Toolbar({
  query,
  onQuery,
  inputRef,
  sort,
  onSort,
  mode,
  onAddFile,
  onAddFolder,
  onAddUrl,
  onRefresh,
  checking,
}: ToolbarProps) {
  const urlPrimary = mode === 'url'

  return (
    <header className="toolbar">
      <div className="search">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="搜索名称、备注或路径…"
          spellCheck={false}
        />
        {query ? (
          <button className="icon-btn tiny" onClick={() => onQuery('')} title="清空">
            ✕
          </button>
        ) : null}
      </div>

      <div className="toolbar-right">
        <select
          className="select"
          value={sort}
          onChange={(e) => onSort(e.target.value as SortMode)}
          title="排序方式"
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>

        <button className="btn ghost" onClick={onRefresh} disabled={checking} title="重新检测路径">
          {checking ? '检测中…' : '检测路径'}
        </button>

        {mode === 'url' ? null : (
          <>
            <button className="btn" onClick={onAddFolder}>
              ＋ 文件夹
            </button>
            <button className="btn primary" onClick={onAddFile}>
              ＋ 文件
            </button>
          </>
        )}

        {mode === 'file' ? null : (
          <button className={`btn ${urlPrimary ? 'primary' : ''}`} onClick={onAddUrl}>
            ＋ 网址
          </button>
        )}
      </div>
    </header>
  )
}
