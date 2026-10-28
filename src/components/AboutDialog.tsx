import { useLayoutEffect, useRef } from 'react'
import type { AppInfo } from '../../electron/preload'
import { CHANGELOG, LATEST_VERSION, TAG_LABEL } from '../changelog'
import Modal from './Modal'

interface AboutDialogProps {
  info: AppInfo | null
  /** 由「检测到新版本」自动打开时，顶部给一条提示 */
  freshUpdate?: boolean
  onClose: () => void
  onOpenDataDir: (dir: string) => void
}

export default function AboutDialog(props: AboutDialogProps) {
  const { info, freshUpdate, onClose, onOpenDataDir } = props
  const bodyRef = useRef<HTMLDivElement>(null)
  // 版本信息异步到达会让内容高度变化，这里保证每次打开都从顶部开始
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [])

  const current = info?.version ?? LATEST_VERSION
  // 打包版的 app 跑在 app.asar 里；dev 模式跑源码目录
  const packaged = !!info && (info.isPackaged || info.appPath.includes('.asar'))
  const runtime = info
    ? `Electron ${info.versions.electron} · Chromium ${info.versions.chrome} · Node ${info.versions.node}`
    : '正在读取运行环境…'

  return (
    <Modal title="关于 LocalHub" onClose={onClose} width={580}>
      <div className="about" ref={bodyRef}>
        <div className="about-hero">
          <div className="about-logo">LH</div>
          <div className="about-meta">
            <div className="about-name">
              LocalHub
              <span className="about-ver">v{current}</span>
              {info && !packaged ? <span className="about-env">开发版</span> : null}
            </div>
            <p className="about-sub">纯本地资源管理器 · 数据只存在本机</p>
            <p className="about-runtime">{runtime}</p>
          </div>
        </div>

        {freshUpdate ? (
          <div className="about-fresh">已更新到 v{current}，以下是本次更新内容</div>
        ) : null}

        <div className="about-datadir">
          <div className="about-datadir-text">
            <span>数据目录</span>
            <code title={info?.dataDir ?? ''}>{info?.dataDir ?? '…'}</code>
          </div>
          <button
            className="btn tiny"
            disabled={!info?.dataDir}
            onClick={() => info?.dataDir && onOpenDataDir(info.dataDir)}
          >
            定位
          </button>
        </div>

        <div className="release-list">
          {CHANGELOG.map((rel) => {
            const isCurrent = rel.version === current
            return (
              <section key={rel.version} className={`release ${isCurrent ? 'current' : ''}`}>
                <div className="release-head">
                  <span className="release-ver">v{rel.version}</span>
                  <span className="release-date">{rel.date}</span>
                  {isCurrent ? <span className="release-badge">当前版本</span> : null}
                </div>
                <p className="release-summary">{rel.summary}</p>
                <ul className="release-items">
                  {rel.changes.map((c, i) => (
                    <li key={i}>
                      <span className={`tag ${c.tag}`}>{TAG_LABEL[c.tag]}</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
