/**
 * dsh-web-archive — node half（构建产物，与 src/index.ts 对应）。
 *
 * 纯 UI 插件：空 apply 让插件出现在宿主插件树；浏览器端 bundle 由
 * dshClient 声明 + exports["./client"] 提供。
 */

export function apply() {}
