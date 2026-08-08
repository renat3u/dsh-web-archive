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
`dshClient` 声明让 client-modules 服务自动注入浏览器 bundle。

### 方式一：`dsh plugin`（标准流程，CLI 可用时）

```sh
dsh plugin --profile web add file:/dsh-web-archive
```

`dsh plugin add` 会 pnpm 安装依赖，并把声明了 `dsh.bundle` 的包自动加进
profile 的 `dsh.profile.bundles` 层列表。

### 方式二：手动挂载（等价于上面的结果）

1. 把插件放进 profile 的 node_modules（pnpm 风格软链）：

   ```sh
   ln -s /dsh-web-archive /root/.dsh/profiles/node_modules/dsh-web-archive
   ```

2. 在 profile manifest（`/root/.dsh/profiles/web/package.json`）里登记：

   ```json
   "dependencies": { "dsh-web-archive": "file:/dsh-web-archive" },
   "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-web-archive"] } }
   ```

3. 重启 `dsh web`（Ctrl+C 后重新运行启动命令），刷新页面。

### 方式三：marisa / dshx

```sh
dshx install /dsh-web-archive --enable
```

### 方式四：plugin-registry / dsh.plugin.json

给包补一份 `dsh.plugin.json` 清单后走 registry 的 Web 面板安装（目录或
tarball 均可）。

> 注：profile 的 `cordis.patch.yml` 是 id 定向覆盖层，不能插入新行；
> 新增插件行必须走 bundle 的 `insert` 列表（见 `cordis.patch.yml`）。

## 构建

```sh
node build.mjs          # 产出 lib/client.js（esbuild，自包含 iife）
```

优先用 PATH 中的 esbuild，否则自动 `pnpm dlx esbuild`。`lib/client.js`
已随仓库提供，改 `src/` 后重新构建即可。

## 文件结构

```
dsh-web-archive/
├── package.json        # dshClient + dsh.bundle 声明 + exports["./client"]
├── cordis.patch.yml    # bundle 层：insert 一行挂载本插件
├── build.mjs           # 构建脚本（esbuild）
├── tsconfig.json
├── src/
│   ├── index.ts        # host half：空 apply（让插件出现在宿主插件树）
│   ├── client.ts       # browser half：cordis 插件入口
│   └── deep-sleep.ts   # DeepSleepController：折叠/展开核心
└── lib/
    ├── index.js        # host half 产物
    └── client.js       # 浏览器 bundle（已构建）
```

## 兼容性

DOM 契约对齐 20260807T130646Z 快照（`data-chat-flow` /
`data-chat-call-id` 等）。dsh 后续版本若改动这些属性，更新
`src/deep-sleep.ts` 顶部的选择器即可。
