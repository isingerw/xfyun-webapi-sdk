import { defineConfig } from 'tsup'
import fs from 'node:fs'
import path from 'node:path'

// 在构建结束后将 worklet 文件拷贝到 dist/worklet，避免依赖 shell 命令，增强跨平台稳健性
const copyWorkletPlugin = {
  name: 'copy-worklet',
  setup(build: any) {
    build.onEnd(() => {
      const srcDir = path.resolve(__dirname, 'src/worklet')
      if (!fs.existsSync(srcDir)) return

      const targets = [
        path.resolve(__dirname, 'dist/worklet'),
        path.resolve(__dirname, 'dist/vue/worklet'),
        path.resolve(__dirname, 'dist/react/worklet'),
      ]

      for (const outDir of targets) {
        fs.mkdirSync(outDir, { recursive: true })
        for (const file of fs.readdirSync(srcDir)) {
          const src = path.join(srcDir, file)
          const dest = path.join(outDir, file)
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest)
          }
        }
      }
    })
  },
}

defineConfig([
  {
    entry: ['src/index.ts'], // 框架无关的“核心 SDK”入口。只暴露底层 Client、类型与工具函数（如 IatClient、TtsClient、RtasrClient、DtsClient、音频工具等）。不依赖 React。
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    clean: true, // 只清一次
    esbuildPlugins: [copyWorkletPlugin],
  },
  {
    entry: ['src/react/index.ts'], // React 专用入口。基于核心能力封装成 React Hooks（如 useIat、useTts、useRtasr、useDts），可能还包含与 React 生命周期、状态相关的封装。依赖 React。
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist/react',
    clean: false,
    esbuildPlugins: [copyWorkletPlugin],
  },
  {
    entry: ['src/vue/index.ts'], // Vue 专用入口（Vue2/3 共用组合式 API）
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist/vue',
    clean: false,
    esbuildPlugins: [copyWorkletPlugin],
  },
])
