/**
 * dsh-web-archive 构建脚本。
 *
 * 产出：
 *   lib/index.js   —— host half（静态文件，见 lib/index.js，无需构建）
 *   lib/client.js  —— browser bundle：自包含 iife，执行时向
 *                     window.__ModuleLoader__.load({ id, factory }) 注册。
 *
 * 无本地依赖：优先用 PATH 里的 esbuild，否则用 pnpm dlx 拉取一次。
 */
import { spawnSync } from 'node:child_process'

const ESBUILD_PIN = 'esbuild@0.25.0'

const CLIENT_ARGS = [
  'src/client.ts',
  '--bundle',
  '--format=iife',
  '--global-name=__dswsBundle',
  '--platform=browser',
  '--target=es2020',
  '--outfile=lib/client.js',
  '--banner:js=window.__ModuleLoader__.load({id:"dsh-web-archive",factory:function(require){',
  '--footer:js=return __dswsBundle;}});',
]

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' })
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`${cmd} failed (${result.status ?? result.error?.message})`)
  }
}

console.log('[dsh-web-archive] building lib/client.js …')
try {
  run('esbuild', CLIENT_ARGS)
} catch {
  console.log('[dsh-web-archive] esbuild not on PATH, using pnpm dlx …')
  run('pnpm', ['dlx', ESBUILD_PIN, ...CLIENT_ARGS])
}
console.log('[dsh-web-archive] done: lib/client.js')
