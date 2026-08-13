/**
 * dsh-web-archive 构建脚本。
 *
 * 产出：
 *   lib/index.js   —— host half（静态文件，见 lib/index.js，无需构建）
 *   lib/client.js  —— browser bundle：自包含 iife，执行时向
 *                     window.__ModuleLoader__.load({ id, factory }) 注册。
 *
 * 构建器：本地 devDependency esbuild（JS API）。不用 spawn CLI：Windows 下
 * 经 shell 传 banner/footer 这类含引号与括号的参数会被 cmd 拆坏。
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const CLIENT_OPTIONS = {
  entryPoints: ['src/client.ts'],
  bundle: true,
  format: 'iife',
  globalName: '__dswsBundle',
  platform: 'browser',
  target: 'es2020',
  outfile: 'lib/client.js',
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-web-archive",factory:function(require){' },
  footer: { js: 'return __dswsBundle;}});' },
}

console.log('[dsh-web-archive] building lib/client.js …')
try {
  const esbuild = require('esbuild')
  await esbuild.build(CLIENT_OPTIONS)
} catch (error) {
  if (error?.code === 'MODULE_NOT_FOUND') {
    throw new Error(
      '[dsh-web-archive] esbuild is a devDependency of this package; run `pnpm install` (or `npm install`) first',
      { cause: error },
    )
  }
  throw error
}
console.log('[dsh-web-archive] done: lib/client.js')
