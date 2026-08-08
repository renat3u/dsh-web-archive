/**
 * dsh-web-archive — node half.
 *
 * 纯 UI 插件：host 侧没有行为，空的 apply 让插件出现在宿主 cordis.yml /
 * Loader 的插件树里（与 ui-slash 等客户端插件的模式一致）。浏览器端
 * bundle 通过 package.json 的 dshClient 声明 + exports["./client"] 被
 * dsh web 的 client-modules 服务发现并注入页面。
 */

/** Host 插件体 —— 无 host 侧行为。 */
export function apply(): void {}
