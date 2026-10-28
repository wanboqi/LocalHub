// 宿主终端若注入了 ELECTRON_RUN_AS_NODE（例如在 Electron 壳内启动），
// 子进程会以纯 Node 模式运行而无法创建窗口，这里提前清除。
delete process.env.ELECTRON_RUN_AS_NODE

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: { build: { outDir: 'dist-electron' } },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: { build: { outDir: 'dist-electron' } },
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
