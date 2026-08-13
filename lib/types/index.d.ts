/**
 * dsh-web-archive — host half 类型声明。
 *
 * 纯 UI 插件：host 侧没有行为，空的 apply 让插件出现在宿主插件树；
 * 浏览器端 bundle 通过 package.json 的 dsh.client 声明 + exports["./client"]
 * 被 dsh web 的 client-modules 服务发现并注入页面。
 */

/** Host 插件体 —— 无 host 侧行为。 */
export function apply(): void
