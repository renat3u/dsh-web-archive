# dsh-web-archive

**Deep Sleeping...** — DeepSeek Harness (dsh) Web 模式的客户端插件。

把会话里**正文之外的所有 display**（工具卡片 read / bash / web_search / grep /
edit 等，以及消息内的 **Think 推理块**，含运行中的调用）折叠成内联的小卡片，
**无 emoji、与 Read/Think/Bash 卡片同款样式、放在它们原来的位置**：

- **每条消息的 think 组 + 其后紧跟的工具组合成一块**（落单的 think 组 /
  工具组各自成块），工具组区域随块折叠、不留空白；
- 正文消息保持 `文本a - [折叠块] - 文本b - 文本c` 的原始结构。

```
Deep Sleeping... (3)            ← 折叠态，点击展开
Deep Sleeping... (3) · 收起     ← 展开态，所有卡片原地显示
```

前端不再出现一长串 Read / Think / Bash 卡片；正文消息完全不受影响。

## 特性

- **零核心改动**：纯浏览器端插件，不修改 dsh 任何源码、不注册 slot key，
  不会与内置工具卡片的 `conversation.chat.toolview` 注册冲突。
- **零运行时依赖**：bundle 完全自包含，不 require 任何模块表条目。
- **Think 也折叠**：消息内的推理块（`data-variant="think"`）与工具卡片
  一并合并。
- **实时跟随**：MutationObserver + rAF 合并，流式新卡片、卡片结算、切换
  会话都自动重放折叠状态。
- **选择联动**：折叠态下若有行被选中（详情联动），自动展开该簇，避免
  看不到正在查看的卡片。
- **主题适配**：颜色走 dsh 的 `--dsw-*` CSS 变量（带兜底值），明暗主题
  都可用。

## 工作原理

ChatView 渲染时对每个工具调用行写入稳定 data 属性：

| 元素 | 属性 |
|---|---|
| 会话流容器 | `[data-chat-flow]` |
| 工具调用行（含运行中） | `[data-chat-call-id]` / `data-chat-anchor-key="call:…"` |
| Think 推理块行 | `[data-variant="think"]` 且无 `data-tool` |
| run_code 子派发行 | 位于 `[data-subcalls]` 内（不折叠，跟随父卡片） |
| 正文消息 | `data-chat-anchor-key="node:…"`（不折叠，且会断开簇） |

插件只做两件事：

1. 把 `[data-chat-flow]` 里的**非正文行**——顶层 `[data-chat-call-id]`
   工具卡片行 + `[data-variant="think"]` 且无 `data-tool` 的推理块行——
   `display:none`（React 的 vdom diff 不会覆盖 CSSOM 上的手动样式）；
2. 把**每个回合合成一块**：某条消息的 think 组与紧跟其后的工具组（跳过
   装饰元素）合并，在 think 消息的**原位**插入一张与工具卡片同款样式的
   小卡片（`Deep Sleeping... (N)`，N = think 行数 + 工具卡片数），工具组
   元素随块折叠；点击切换展开/收起。落单的 think 组 / 工具组各自成块。
   正文消息保持 `文本a - [折叠块] - 文本b - 文本c` 的原始结构。

注入的 chip 在 React 管理的 flow 子树内，但只做前置插入与 display 切换，
MutationObserver + rAF 合并重放，React 重渲染/切换会话/流式新卡片都会自动
跟上（自愈）；卸载时全部还原。

## 安装

插件以 **bundle 层** 方式挂载进 dsh web profile（`package.json` 里的
`dsh.bundle.patch` 声明 + 包内 `cordis.patch.yml` 的 `insert` 行），
`dsh.client` 声明（`platform: "web"`）让 client-modules 服务自动注入浏览器 bundle。

> 命令形式：官方约定源码 checkout 场景统一用 `pnpm dsh <args...>` 运行
> TypeScript 入口并透传参数（见下文「运行与构建」）；npm 全局安装后可直接
> `dsh <args...>`。下文命令按 `dsh …` 泛称书写。

### 方式一：本地路径

```sh
pnpm dsh plugin --profile web add file:/path/to/dsh-web-archive
```

`dsh plugin add` 会 pnpm 安装依赖，并把声明了 `dsh.bundle` 的包自动加进
profile 的 `dsh.profile.bundles` 层列表。

### 方式二：手动挂载（等价于上面的结果）

1. 把插件放进 profile 的 node_modules（pnpm 风格软链）：

   ```sh
   ln -s /path/to/dsh-web-archive $DSH_HOME/profiles/node_modules/dsh-web-archive
   ```

2. 在 profile manifest（`$DSH_HOME/profiles/web/package.json`）里登记：

   ```json
   "dependencies": { "dsh-web-archive": "file:/path/to/dsh-web-archive" },
   "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-web-archive"] } }
   ```

3. 重启 web 表面（源码环境 Ctrl+C 后重跑 `pnpm dsh web`），刷新页面。

> 注：profile 的 `cordis.patch.yml` 用户层与 bundle 层走同一个 patch
> 算法，支持 `insert` 行；长驻表面（web profile）通过 watch-only HMR
> 热重放用户层——新插入的行不需要重启即可挂载（新增的 client 行要等一次
> 页面刷新让浏览器拿到新的 `window.__DSH_BOOT__` 图）。bundle 层
> （`dsh.profile.bundles`）的增删则要重启 web 表面才生效。

## 运行与构建

官方源码构建形式（仓库 checkout 内）：

```sh
pnpm install      # 安装依赖（一次性）
pnpm run build    # 准备仓库产物（一次性）
pnpm dsh web      # 启动 Web UI，无需重新构建
```

`pnpm dsh <args...>` 是官方约定的源码运行形式（`dsh web` 是
`--profile web` 的别名）。`pnpm install` **不会**把 `dsh` 注册进 shell 的
全局 PATH——`pnpm dsh` 每次都要带前缀。裸 `dsh` 命令需要 npm 全局安装
（`npm install -g @deepseek-ai/dsh`），或走官方安装包示例
`npx @deepseek-ai/dsh web`。开发 client 插件时可另开 `pnpm run dev:web`
（官方 dev 监视器）：它重建 client bundle 并触发 client-hmr 热替换；新增
插件行仍需一次页面刷新拿到新的 boot 图。

插件自身 bundle 构建：

```sh
node build.mjs    # 产出 lib/client.js（esbuild，自包含 iife）
```

构建走本地 devDependency esbuild（JS API，无 shell 依赖）；仓库根执行
`npm install`（或 pnpm install）后即可运行。`lib/client.js` 随包提供，
改 `src/` 后重新构建即可。


## 文件结构

```
dsh-web-archive/
├── package.json        # dsh.client + dsh.bundle 声明 + npm 发布元数据 + exports["./client"]
├── cordis.patch.yml    # bundle 层：insert 一行挂载本插件
├── build.mjs           # 构建脚本（esbuild；prepack 钩子调用）
├── tsconfig.json
├── src/
│   ├── index.ts        # host half：空 apply（让插件出现在宿主插件树）
│   ├── client.ts       # browser half：cordis 插件入口
│   └── deep-sleep.ts   # DeepSleepController：折叠/展开核心
└── lib/
    ├── index.js        # host half 产物
    ├── client.js       # 浏览器 bundle（已构建）
    └── types/          # 手写类型声明（index.d.ts / client/index.d.ts）
```

## 兼容性

DOM 契约基于官方 Web 客户端 ChatView 渲染的稳定 data 属性：
`data-chat-flow` / `data-chat-call-id` / `data-chat-anchor-key` /
`data-subcalls` / `data-selected` / `data-state` / `data-variant`。
当前构建的 CSS Modules 类名是短哈希，正文检测不使用类名字面量，而是文本
节点 walker（跳过 think 行 / 工具卡片 / 插件自身的 chip），对类名变化
免疫。官方后续版本若改动这些属性，更新 `src/deep-sleep.ts` 顶部的
选择器即可。
