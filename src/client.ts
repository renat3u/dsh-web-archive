/**
 * dsh-web-archive — browser half（客户端插件入口）。
 *
 * 职责：在 dsh web 前端里，把会话正文之外的工具 display（read / bash /
 * web_search / think 推理块 等一切非正文卡片）折叠成内联的小卡片
 * "Deep Sleeping... (N)"——无 emoji、与工具卡片同款样式、放在它们原来的
 * 位置。**连续堆积（工具组 + 纯 think 消息）合并成一块，带正文文本的
 * 消息断开合并**（其 think 并入前面的块），形成
 * 文本A - [折叠块] - 文本B - [折叠块] - 文本C 的结构。
 * 点击展开后原地显示全部卡片，再点收起。
 *
 * 实现方式：纯 DOM 层（MutationObserver + rAF 合并），零核心改动、零运行时
 * 依赖、不注册任何 slot key，因此不会与内置 read/bash/... 的
 * conversation.chat.toolview 注册冲突。识别依据是 ChatView 渲染时写死的
 * 稳定 data 属性（data-chat-flow / data-chat-call-id / data-variant /
 * data-chat-anchor-key / data-subcalls），与官方 Web 客户端的
 * DOM 契约对齐。
 */
import { DeepSleepController } from './deep-sleep.ts'

export const name = 'dsh-web-archive'

/** 需要的宿主服务：无 —— 纯 DOM 操作，不依赖任何 client 服务。 */
export const inject: string[] = []

/** 客户端根上下文的最小结构化类型（仅用 cordis 标准 effect，无运行时依赖）。 */
export interface DeepSleepClientCtx {
  effect(fn: () => unknown, label?: string): unknown
}

export function apply(ctx: DeepSleepClientCtx): void {
  // 注意:cordis 的 ctx.effect(fn) 会【立即执行】fn,并把 fn 的返回值当作
  // 插件卸载时的清理函数(与 ui-slash 等官方插件同款写法)。
  ctx.effect(() => {
    const controller = new DeepSleepController()
    controller.start()
    return () => controller.stop()
  }, 'dsh-web-archive: deep-sleep observer')
}
