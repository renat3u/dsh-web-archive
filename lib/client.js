window.__ModuleLoader__.load({id:"dsh-web-archive",factory:function(require){
"use strict";
var __dswsBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/client.ts
  var client_exports = {};
  __export(client_exports, {
    apply: () => apply,
    inject: () => inject,
    name: () => name
  });

  // src/deep-sleep.ts
  var STYLE_ID = "dswa-deep-sleep-style";
  var TITLE = "Deep Sleeping...";
  var CHIP_CSS = `
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
`;
  var DeepSleepController = class {
    constructor() {
      __publicField(this, "observer", null);
      __publicField(this, "raf", 0);
      __publicField(this, "disposed", false);
      __publicField(this, "flow", null);
      /** host 元素 → 它的 chip（每个簇一张）。 */
      __publicField(this, "chips", /* @__PURE__ */ new Map());
      /** host 元素 → 展开状态（按流容器元素隔离，切换会话不串状态）。 */
      __publicField(this, "expandedByHost", /* @__PURE__ */ new WeakMap());
      /** 最近一轮 pass 见过的全部行（stop 时统一还原）。 */
      __publicField(this, "allRows", []);
      /** host → 该块需要随折叠的容器（工具组元素 / 空 think 壳）。 */
      __publicField(this, "blockContainers", /* @__PURE__ */ new Map());
    }
    start() {
      if (this.disposed) return;
      injectStyle();
      this.observer = new MutationObserver(() => this.schedule());
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-selected", "data-state"]
      });
      this.schedule();
    }
    stop() {
      this.disposed = true;
      if (this.raf !== 0) cancelAnimationFrame(this.raf);
      this.observer?.disconnect();
      applyRows(this.allRows, [...this.blockContainers.values()].flat(), true);
      for (const chip of this.chips.values()) chip.remove();
      this.chips.clear();
      removeStyle();
    }
    schedule() {
      if (this.disposed || this.raf !== 0) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.pass();
      });
    }
    /** 一轮重放：重算堆积 → 应用折叠/展开 → 摆放 chip。 */
    pass() {
      if (this.disposed) return;
      const flow = findFlow();
      this.flow = flow;
      if (flow === null) {
        applyRows(this.allRows, [...this.blockContainers.values()].flat(), true);
        this.allRows = [];
        this.blockContainers = /* @__PURE__ */ new Map();
        for (const chip of this.chips.values()) chip.remove();
        this.chips.clear();
        return;
      }
      const blocks = findBlocks(flow);
      const hosts = /* @__PURE__ */ new Set();
      const nextContainers = /* @__PURE__ */ new Map();
      const nextRows = /* @__PURE__ */ new Set();
      const nextContainerSet = /* @__PURE__ */ new Set();
      for (const block of blocks) {
        for (const row of block.rows) nextRows.add(row);
        for (const container of block.containers) nextContainerSet.add(container);
      }
      for (const row of this.allRows) {
        if (!nextRows.has(row) && row.isConnected) row.style.display = "";
      }
      for (const container of [...this.blockContainers.values()].flat()) {
        if (!nextContainerSet.has(container) && container.isConnected) container.style.display = "";
      }
      for (const block of blocks) {
        const { host, rows, containers } = block;
        hosts.add(host);
        nextContainers.set(host, [...containers]);
        const expanded = this.expandedByHost.get(host) ?? false;
        if (!expanded && rows.some((row) => row.hasAttribute("data-selected"))) {
          this.expandedByHost.set(host, true);
        }
        const isExpanded = this.expandedByHost.get(host) ?? false;
        applyRows(rows, containers, isExpanded);
        const chip = this.ensureChip(host, rows);
        updateChip(chip, rows.length, isExpanded);
      }
      this.blockContainers = nextContainers;
      for (const [host, chip] of [...this.chips]) {
        if (!hosts.has(host) || !host.isConnected) {
          chip.remove();
          this.chips.delete(host);
        }
      }
      this.allRows = blocks.flatMap((b) => b.rows);
    }
    /** 当前块里 host 对应的容器引用（click 时用）。 */
    containersOf(host) {
      return this.blockContainers.get(host) ?? [];
    }
    /** 创建（或复用）宿主内部的折叠卡片。 */
    ensureChip(host, rows) {
      const existing = this.chips.get(host);
      if (existing !== void 0 && existing.isConnected && existing.parentElement === host) {
        return existing;
      }
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "dswa-chip";
      chip.setAttribute("aria-expanded", "false");
      chip.appendChild(createSpan("dswa-chip-leading"));
      chip.appendChild(createSpan("dswa-chip-title"));
      chip.appendChild(createSpan("dswa-chip-sep"));
      chip.appendChild(createSpan("dswa-chip-summary"));
      chip.addEventListener("click", () => {
        const next = !(this.expandedByHost.get(host) ?? false);
        this.expandedByHost.set(host, next);
        applyRows(rows, this.blockContainers.get(host) ?? [], next);
        updateChip(chip, rows.length, next);
      });
      host.prepend(chip);
      this.chips.set(host, chip);
      return chip;
    }
  };
  function createSpan(cls) {
    const span = document.createElement("span");
    span.className = cls;
    return span;
  }
  function findFlow() {
    const flows = document.querySelectorAll("[data-chat-flow]");
    for (const flow of flows) {
      if (flow.offsetParent !== null || flow.getBoundingClientRect().width > 0) return flow;
    }
    return flows[0] ?? null;
  }
  function findBlocks(flow) {
    const blocks = [];
    const children = [...flow.children].filter((el) => el instanceof HTMLElement);
    let run = null;
    for (const el of children) {
      const thinkRows = thinkRowsIn(el);
      const callRows = callRowsIn(el);
      const isToolPile = callRows.length > 0;
      const hasText = !isToolPile && thinkRows.length > 0 ? hasBodyText(el) : false;
      const isThinkPile = !isToolPile && thinkRows.length > 0 && !hasText;
      if (isToolPile || isThinkPile) {
        if (run === null) {
          run = { host: el, rows: [], containers: [] };
          blocks.push(run);
        }
        run.rows.push(...thinkRows, ...callRows);
        if (el !== run.host && (isToolPile || !hasContentOutsideRows(el, thinkRows))) {
          run.containers.push(el);
        }
      } else if (el.hasAttribute("data-chat-anchor-key")) {
        if (thinkRows.length > 0) {
          if (run === null) {
            run = { host: el, rows: [], containers: [] };
            blocks.push(run);
          }
          run.rows.push(...thinkRows);
        }
        run = null;
      }
    }
    return blocks;
  }
  function hasBodyText(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) !== null) {
      if (node.data.trim() === "") continue;
      const parent = node.parentElement;
      if (parent !== null && parent.closest('[data-variant="think"], [data-chat-call-id], .dswa-chip') !== null) continue;
      return true;
    }
    return false;
  }
  function hasContentOutsideRows(el, rows) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) !== null) {
      if (node.data.trim() === "") continue;
      const parent = node.parentElement;
      if (parent !== null && parent.closest('[data-variant="think"], [data-chat-call-id], .dswa-chip') !== null) continue;
      return true;
    }
    for (const candidate of el.querySelectorAll("*")) {
      if (candidate.closest('[data-variant="think"], [data-chat-call-id], .dswa-chip') !== null) continue;
      if (rows.some((row) => row !== candidate && candidate.contains(row))) continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  }
  function thinkRowsIn(el) {
    const rows = [];
    for (const row of el.querySelectorAll('[data-variant="think"]:not([data-tool])')) {
      if (row.closest("[data-chat-call-id]") !== null) continue;
      if (row.closest("[data-subcalls]") !== null) continue;
      rows.push(row);
    }
    return rows;
  }
  function callRowsIn(el) {
    const rows = [];
    for (const row of el.querySelectorAll("[data-chat-call-id]")) {
      if (row.closest("[data-subcalls]") !== null) continue;
      if (row.closest("[data-chat-call-id]") !== row) continue;
      rows.push(row);
    }
    return rows;
  }
  function applyRows(rows, containers, expanded) {
    for (const row of rows) {
      row.style.display = expanded ? "" : "none";
    }
    for (const container of containers) {
      container.style.display = expanded ? "" : "none";
    }
  }
  function updateChip(chip, count, expanded) {
    const title = chip.querySelector(".dswa-chip-title");
    const summary = chip.querySelector(".dswa-chip-summary");
    if (title !== null) title.textContent = TITLE;
    if (summary !== null) summary.textContent = expanded ? ` (${count}) \xB7 \u6536\u8D77` : ` (${count})`;
    chip.setAttribute("aria-expanded", String(expanded));
    chip.title = expanded ? "\u6536\u8D77\u8FD9\u4E9B\u5361\u7247" : "\u5C55\u5F00\u8FD9\u4E9B\u5361\u7247";
  }
  function injectStyle() {
    if (document.getElementById(STYLE_ID) !== null) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CHIP_CSS;
    document.head.appendChild(style);
  }
  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  // src/client.ts
  var name = "dsh-web-archive";
  var inject = [];
  function apply(ctx) {
    ctx.effect(() => {
      const controller = new DeepSleepController();
      controller.start();
      return () => controller.stop();
    }, "dsh-web-archive: deep-sleep observer");
  }
  return __toCommonJS(client_exports);
})();
return __dswsBundle;}});
