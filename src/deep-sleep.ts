/**
 * DeepSleepController —— dsh-web-archive 的核心。
 *
 * 把会话流（[data-chat-flow]）里的“非正文 display”折叠成内联的小卡片：
 * - 工具调用行：[data-chat-call-id]（read/bash/web_search/...，含运行中）
 * - 推理块 Think 行：[data-variant="think"] 且无 data-tool（消息内的推理摘要行）
 *
 * 折叠方式：**每个回合合成一块**——某条消息的 Think 推理组与其后紧跟的
 * 工具组合并成一块（只有 think 或只有工具组时各自成块），在 think 消息的
 * **原位**（消息元素内部）插入一张与工具卡片同款样式的小卡片：
 *
 *   Deep Sleeping... (N)          —— 折叠态，N = think 行数 + 工具卡片数
 *   Deep Sleeping... (N) · 收起   —— 展开态，所有卡片原地显示
 *
 * 结构保持 文本a - [折叠块] - 文本b - 文本c（工具组区域随块折叠、不残留
 * 空白）。无 emoji、无悬浮层：卡片跟随会话流内联排列，与 Read/Think/Bash
 * 卡片样式一致、放在它们原来的位置。
 *
 * 与 React 的关系：chip 插入 React 管理的 flow 子树内，但只做前置插入与
 * style.display 切换（React 的 vdom diff 不会感知也不会清除 CSSOM 上的手动
 * 样式）；MutationObserver 每轮把结构变化合并到一次 requestAnimationFrame
 * 里重放（自愈：React 重渲染、切换会话、流式新卡片都会自动跟上）。
 *
 * 零核心改动：不修改任何 slot 注册，不依赖任何 client 服务。
 */

const STYLE_ID = 'dswa-deep-sleep-style'

const TITLE = 'Deep Sleeping...'

const CHIP_CSS = `
.dswa-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  border-radius: 6px;
  background: var(--dsw-alias-bg-2, rgba(127, 127, 127, 0.07));
  color: var(--dsw-text-1, #333);
  font: 400 14px/24px system-ui, -apple-system, "Segoe UI", sans-serif;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}
.dswa-chip:hover {
  background: var(--dsw-alias-bg-3, rgba(127, 127, 127, 0.13));
}
.dswa-chip .dswa-chip-leading {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.55));
}
.dswa-chip .dswa-chip-sep {
  flex: none;
  width: 2px;
  height: 2px;
  border-radius: 1px;
  background: var(--dsw-alias-label-caption, rgba(127, 127, 127, 0.5));
}
.dswa-chip .dswa-chip-title {
  flex: none;
  font-weight: 400;
}
.dswa-chip .dswa-chip-summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary, #666);
}
`

/** 一个“折叠块”：think 消息（+ 其后紧跟的工具组）合成的一块。 */
interface Block {
  /** chip 插入处：think 消息元素（无 think 时是工具组元素）。 */
  host: HTMLElement
  /** 需要折叠/展开的行（推理块行 + 顶层工具卡片行）。 */
  rows: HTMLElement[]
  /** 需要随块折叠/展开的容器（工具组元素，避免折叠后残留空白）。 */
  containers: HTMLElement[]
}

export class DeepSleepController {
  private observer: MutationObserver | null = null
  private raf = 0
  private disposed = false

  private flow: HTMLElement | null = null
  /** host 元素 → 它的 chip（每个簇一张）。 */
  private chips = new Map<HTMLElement, HTMLButtonElement>()
  /** host 元素 → 展开状态（按流容器元素隔离，切换会话不串状态）。 */
  private expandedByHost = new WeakMap<HTMLElement, boolean>()
  /** 最近一轮 pass 见过的全部行（stop 时统一还原）。 */
  private allRows: HTMLElement[] = []
  /** host → 该块需要随折叠的容器（工具组元素）。 */
  private blockContainers = new Map<HTMLElement, HTMLElement[]>()

  start(): void {
    if (this.disposed) return
    injectStyle()
    this.observer = new MutationObserver(() => this.schedule())
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-selected', 'data-state'],
    })
    this.schedule()
  }

  stop(): void {
    this.disposed = true
    if (this.raf !== 0) cancelAnimationFrame(this.raf)
    this.observer?.disconnect()
    // 还原所有被折叠的行/容器并移除全部 chip。
    applyRows(this.allRows, [...this.blockContainers.values()].flat(), true)
    for (const chip of this.chips.values()) chip.remove()
    this.chips.clear()
    removeStyle()
  }

  private schedule(): void {
    if (this.disposed || this.raf !== 0) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.pass()
    })
  }

  /** 一轮重放：重算堆积 → 应用折叠/展开 → 摆放 chip。 */
  private pass(): void {
    if (this.disposed) return

    const flow = findFlow()
    this.flow = flow
    if (flow === null) {
      // 没有会话流：清理全部 chip。
      for (const chip of this.chips.values()) chip.remove()
      this.chips.clear()
      return
    }

    const blocks = findBlocks(flow)
    const hosts = new Set<HTMLElement>()

    for (const block of blocks) {
      const { host, rows, containers } = block
      hosts.add(host)

      const expanded = this.expandedByHost.get(host) ?? false
      // 折叠态下若有行被选中（详情联动），自动展开该块。
      if (!expanded && rows.some(row => row.hasAttribute('data-selected'))) {
        this.expandedByHost.set(host, true)
      }
      const isExpanded = this.expandedByHost.get(host) ?? false

      applyRows(rows, containers, isExpanded)
      const chip = this.ensureChip(host, rows)
      updateChip(chip, rows.length, isExpanded)
    }

    // 移除宿主已不在流里的陈旧 chip（自愈：React 重渲染换掉了宿主元素）。
    for (const [host, chip] of [...this.chips]) {
      if (!hosts.has(host) || !host.isConnected) {
        chip.remove()
        this.chips.delete(host)
      }
    }

    this.allRows = blocks.flatMap(b => b.rows)
  }

  /** 当前块里 host 对应的容器引用（click 时用）。 */
  private containersOf(host: HTMLElement): readonly HTMLElement[] {
    return this.blockContainers.get(host) ?? []
  }

  /** 创建（或复用）宿主内部的折叠卡片。 */
  private ensureChip(host: HTMLElement, rows: readonly HTMLElement[]): HTMLButtonElement {
    const existing = this.chips.get(host)
    if (existing !== undefined && existing.isConnected && existing.parentElement === host) {
      return existing
    }
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'dswa-chip'
    chip.setAttribute('aria-expanded', 'false')
    chip.appendChild(createSpan('dswa-chip-leading'))
    chip.appendChild(createSpan('dswa-chip-title'))
    chip.appendChild(createSpan('dswa-chip-sep'))
    chip.appendChild(createSpan('dswa-chip-summary'))
    chip.addEventListener('click', () => {
      const next = !(this.expandedByHost.get(host) ?? false)
      this.expandedByHost.set(host, next)
      applyRows(rows, this.blockContainers.get(host) ?? [], next)
      updateChip(chip, rows.length, next)
    })
    // 插到消息/工具组最前（与折叠掉的卡片同一位置）。
    host.prepend(chip)
    this.chips.set(host, chip)
    return chip
  }
}

function createSpan(cls: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = cls
  return span
}

/** 找到当前可见的会话流容器。 */
function findFlow(): HTMLElement | null {
  const flows = document.querySelectorAll<HTMLElement>('[data-chat-flow]')
  for (const flow of flows) {
    if (flow.offsetParent !== null || flow.getBoundingClientRect().width > 0) return flow
  }
  return flows[0] ?? null
}

/**
 * 收集流容器里的“折叠块”。规则：
 * - 堆积 = 工具组（工具卡片行）或纯 think 消息（推理块行、无正文文本）；
 * - **连续堆积合并成一块**；
 * - **带正文文本的消息（即使含 think 行）会断开合并**：它的 think 行先并入
 *   前面的块（无块则自成一块），然后正文文本作为分界；
 * - 纯文本消息直接断开；装饰元素（StreamingTail/TurnStatus/hints）不断开。
 * 结果：文本A - [折叠块] - 文本B - [折叠块] - 文本C。
 */
function findBlocks(flow: HTMLElement): Block[] {
  const blocks: Block[] = []
  const children: HTMLElement[] = [...flow.children].filter((el): el is HTMLElement => el instanceof HTMLElement)
  let run: Block | null = null

  for (const el of children) {
    const thinkRows = thinkRowsIn(el)
    const callRows = callRowsIn(el)
    const isToolPile = callRows.length > 0
    // 只有“纯 think 候选”才需要正文检测：工具组与装饰元素不消耗 walker。
    const hasText = !isToolPile && thinkRows.length > 0 ? hasBodyText(el) : false

    if (isToolPile || (thinkRows.length > 0 && !hasText)) {
      // 堆积（工具组 / 纯 think 消息）→ 并入当前块。
      if (run === null) {
        run = { host: el, rows: [], containers: [] }
        blocks.push(run)
      }
      run.rows.push(...thinkRows, ...callRows)
      // 工具组随块折叠；若工具组就是块宿主（chip 插在它内部），不能隐藏它。
      if (isToolPile && el !== run.host) {
        run.containers.push(el)
      }
    } else if (el.hasAttribute('data-chat-anchor-key')) {
      // 正文消息：think 先并入前面的块（无块则自成一块），然后断开合并。
      if (thinkRows.length > 0) {
        if (run === null) {
          run = { host: el, rows: [], containers: [] }
          blocks.push(run)
        }
        run.rows.push(...thinkRows)
      }
      run = null
    }
    // 装饰元素（无 anchor 且无行）不打断合并。
  }
  return blocks
}

/** 消息是否含正文文本：正文由 MarkdownText 渲染，但 CSS Modules 构建产物
 * 的类名是短哈希（如 uqINua_body），无法用类名字面量识别。改为文本节点
 * walker：折叠行（think 推理块 / 工具卡片）与插件自己的 chip 之外的任何
 * 非空文本都算正文——正文渲染的段落（p/pre/li 等）必然携带这些文本。 */
function hasBodyText(el: HTMLElement): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null) !== null) {
    if (node.data.trim() === '') continue
    const parent = node.parentElement
    if (parent !== null && parent.closest('[data-variant="think"], [data-chat-call-id], .dswa-chip') !== null) continue
    return true
  }
  return false
}

/** 元素内的推理块行：[data-variant="think"] 且无 data-tool。 */
function thinkRowsIn(el: HTMLElement): HTMLElement[] {
  const rows: HTMLElement[] = []
  for (const row of el.querySelectorAll<HTMLElement>('[data-variant="think"]:not([data-tool])')) {
    if (row.closest('[data-chat-call-id]') !== null) continue
    if (row.closest('[data-subcalls]') !== null) continue
    rows.push(row)
  }
  return rows
}

/** 元素内的顶层工具卡片行（排除 run_code 子派发行与嵌套行）。 */
function callRowsIn(el: HTMLElement): HTMLElement[] {
  const rows: HTMLElement[] = []
  for (const row of el.querySelectorAll<HTMLElement>('[data-chat-call-id]')) {
    if (row.closest('[data-subcalls]') !== null) continue
    if (row.closest('[data-chat-call-id]') !== row) continue
    rows.push(row)
  }
  return rows
}


/** 折叠/展开：只切换 CSSOM display，React 不会覆盖。 */
function applyRows(rows: readonly HTMLElement[], containers: readonly HTMLElement[], expanded: boolean): void {
  for (const row of rows) {
    row.style.display = expanded ? '' : 'none'
  }
  for (const container of containers) {
    container.style.display = expanded ? '' : 'none'
  }
}

function updateChip(chip: HTMLButtonElement, count: number, expanded: boolean): void {
  const title = chip.querySelector<HTMLElement>('.dswa-chip-title')
  const summary = chip.querySelector<HTMLElement>('.dswa-chip-summary')
  if (title !== null) title.textContent = TITLE
  if (summary !== null) summary.textContent = expanded ? ` (${count}) · 收起` : ` (${count})`
  chip.setAttribute('aria-expanded', String(expanded))
  chip.title = expanded ? '收起这些卡片' : '展开这些卡片'
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CHIP_CSS
  document.head.appendChild(style)
}

function removeStyle(): void {
  document.getElementById(STYLE_ID)?.remove()
}
