/**
 * dsh-web-archive — browser half 类型声明。
 *
 * 在 dsh web 前端里把会话正文之外的工具 display 折叠成内联小卡片
 * "Deep Sleeping... (N)"；零核心改动、零运行时依赖、不注册 slot key。
 */

/** 客户端根上下文的最小结构化类型（仅用 cordis 标准 effect，无运行时依赖）。 */
export interface DeepSleepClientCtx {
  effect(fn: () => unknown, label?: string): unknown
}

/** 插件名。 */
export const name: string

/** 需要的宿主服务：无 —— 纯 DOM 操作，不依赖任何 client 服务。 */
export const inject: string[]

/** 插件入口：挂载 DeepSleepController，卸载时还原全部折叠状态。 */
export function apply(ctx: DeepSleepClientCtx): void
