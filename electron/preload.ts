import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface AppInfo {
  name: string
  version: string
  isPackaged: boolean
  appPath: string
  dataDir: string
  dataFile: string
  versions: { electron: string; chrome: string; node: string }
}

const api = {
  load: (): Promise<unknown> => ipcRenderer.invoke('store:load'),
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  save: (data: unknown): Promise<boolean> => ipcRenderer.invoke('store:save', data),
  pick: (kind: 'file' | 'folder'): Promise<string[]> => ipcRenderer.invoke('dialog:pick', kind),
  open: (target: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('shell:open', target),
  reveal: (target: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('shell:reveal', target),
  icons: (targets: string[]): Promise<Record<string, string | null>> =>
    ipcRenderer.invoke('icons:batch', targets),
  probe: (
    targets: string[],
  ): Promise<Record<string, { exists: boolean; isDirectory: boolean }>> =>
    ipcRenderer.invoke('probe:batch', targets),
  /** 拖放时从 File 对象拿到真实磁盘路径（Electron 32+ 推荐做法） */
  pathFor: (file: File): string => webUtils.getPathForFile(file),
}

contextBridge.exposeInMainWorld('api', api)

export type LocalHubApi = typeof api
