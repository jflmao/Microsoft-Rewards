# Microsoft-Rewards

[![node](https://img.shields.io/badge/node-24%2B-brightgreen.svg)](https://nodejs.org/)
[![status](https://img.shields.io/badge/status-stable-green.svg)](https://github.com/huaisha1224/Microsoft-Rewards)
[![license](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](./LICENSE)
[![actions](https://img.shields.io/badge/CI-GitHub%20Actions-orange.svg)](./.github/workflows/microsoft-rewards.yml)

赚取每日 Microsoft Rewards 积分的自动化解决方案。

支持三种运行形态：**油猴脚本**、**本地命令行 / 桌面 GUI**、**GitHub Actions 无头执行**。

---

## 目录

- [方案概览](#方案概览)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
  - [方式一 · GitHub Actions 无头运行（推荐）](#方式一-github-actions-无头运行推荐)
  - [方式二 · 本地命令行](#方式二-本地命令行)
  - [方式三 · 桌面 GUI](#方式三-桌面-gui)
  - [方式四 · Docker](#方式四-docker)
  - [方式五 · 油猴脚本](#方式五-油猴脚本)
- [配置说明](#配置说明)
  - [账户配置](#账户配置)
  - [配置文件](#配置文件)
  - [环境变量覆盖](#环境变量覆盖)
- [推送通知](#推送通知)
- [项目结构](#项目结构)
- [常见问题](#常见问题)
- [免责声明](#免责声明)
- [License](#license)

---

## 方案概览

```
本项目
├── 油猴脚本方案 ............... tampermonkey/
└── 浏览器自动化方案
    ├── 核心逻辑（TypeScript）... src/          ← 跨平台，无头可用
    ├── 桌面 GUI（Python）...... gui/          ← Windows 图形界面外壳
    ├── 控制 API（Node）....... scripts/api/
    └── Docker 编排 ............ Dockerfile / compose.yaml
```

**关键设计**：核心任务逻辑全部位于 `src/`（TypeScript，跨平台），GUI 仅是「配置编辑器 + 子进程启动器」的外壳，与核心零耦合。因此同一套任务逻辑可运行于本地、GUI、Docker 与 GitHub Actions。

---

## 核心特性

**账户管理**

- 多账户支持（`.env` 中 `ACCOUNT_N_*` 环境变量，编号无需连续）
- 会话存储与持久化（`sessions/`，含指纹持久化）
- 2FA 支持（TOTP 自动生成并填入验证码）
- 无密码登录支持
- 每账户独立代理（HTTP/HTTPS/SOCKS4/SOCKS5）

**自动化与控制**

- 无头浏览器操作（Patchright 反检测内核）
- 集群支持（同时多个账户）
- 可配置任务开关
- 三种运行形态共享同一核心：本地 CLI / GUI / CI

**搜索与活动**

- 桌面与移动搜索（配额独立跟踪，互不阻塞）
- 每日集 / 更多促销 / 打卡 / App 活动 / 每日签到 / 阅读赚取（Read-to-Earn）
- 搜索加成 perk 激活（"再搜 N 次得积分"）/ 视觉搜索（可选）
- 连击保护 & 自动领取 dashboard 奖励积分
- 模拟滚动与随机点击，降低风控风险

**搜索词来源（国内推荐 china + local）**

- 中国热搜（百度/头条/抖音/微博/知乎，gmya.net 聚合，多源随机 + 限流退避）
- 本地查询词兜底（`search-queries.json` 中文词库）
- Bing 建议聚类扩展（`clusterSearch`，每个主词扩展一组相关词再搜索）

**通知渠道**

- 企业微信群机器人（`wecom`）、Server 酱、PushPlus、微信 ClawBot
- Discord、Telegram、ntfy
- 控制 API（SSE 实时日志流）+ 可视化面板

---

## 快速开始

### 方式一 · GitHub Actions 无头运行（推荐）

无需本地环境，全自动定时执行，成功后自动推送企业微信摘要。

**1. 克隆仓库并推送到你自己的 GitHub 仓库**

**2. 配置 Secrets**（`Settings → Secrets and variables → Actions → New repository secret`）

| Secret | 必填 | 说明 |
|---|---|---|
| `ACCOUNT_1_EMAIL` | ✅ | 账号邮箱 |
| `ACCOUNT_1_PASSWORD` | 视情况 | 账号密码，留空则走无密码登录 |
| `ACCOUNT_1_TOTP_SECRET` | 建议 | 2FA 的 TOTP 密钥，用于自动填码 |
| `WECOM_WEBHOOK_KEY` | 启用推送时 | 企业微信群机器人 key（URL 中 `key=` 后的 UUID） |

> 账号槽位可跳过：`ACCOUNT_2_*` 存在而 `ACCOUNT_1_*` 缺省是允许的。
> 完整清单（含代理、TOTP、多账户、企业微信）见 **[docs/github-actions.md](./docs/github-actions.md)**。

**3. 触发运行**

- 手动：`Actions` 页面 → `Microsoft Rewards` → `Run workflow`
- 定时：默认每日北京时间 07:00（UTC `0 23 * * *`）

工作流会自动完成：依赖安装 → Chromium 下载 → 配置注入 → 无头执行 → 日志归档 → 成功推送摘要 / 失败输出错误注解。

<details>
<summary>工作流手动触发参数</summary>

| 参数 | 默认值 | 作用 |
|---|---|---|
| `clusters` | `1` | 并发集群数 |
| `search_delay_min` | 空 | 覆盖搜索间隔下限 |
| `search_delay_max` | 空 | 覆盖搜索间隔上限 |
| `skip_run` | `false` | 仅做环境自检与配置校验，不真正执行任务 |

</details>

---

### 方式二 · 本地命令行

```bash
# 1. 安装依赖（Node.js 24+）
npm install
npx patchright install chromium

# 2. 配置账号（.env 已在 .gitignore 中，切勿提交）
copy env.example .env        # Linux/macOS: cp env.example .env
notepad .env                 # 填 ACCOUNT_1_EMAIL / ACCOUNT_1_PASSWORD / ACCOUNT_1_TOTP_SECRET

# 3. 配置任务（可选，缺省自动使用 config.example.json）
copy config.example.json config.json

# 4. 编译并运行
npm run build
npm start
```

常用脚本：

| 命令 | 作用 |
|---|---|
| `npm start` | 运行任务（需先 `npm run build`） |
| `npm run ts-start` | 直接以 TypeScript 运行（免编译，调试用） |
| `npm run dev` | 开发模式（开启 debug 日志） |
| `npm run api` | 启动控制 API 服务（默认 `:3010`） |
| `npm run manual-login` | 交互式手动登录，生成会话 |
| `npm run open-session` | 打开已保存的会话 |
| `npm run clear-sessions` | 清空所有会话 |
| `npm run lint` / `npm run format` | 代码检查 / 格式化 |

---

### 方式三 · 桌面 GUI

Windows 图形界面，可视化编辑账户与任务配置，并一键启停。

```bat
setup.bat        :: 首次使用：自动装 Node、装依赖、初始化配置
start-gui.bat    :: 启动 GUI
```

> GUI 依赖：`python -m pip install customtkinter`（需 Python 3.10+）

GUI 的两个职责——编辑 `.env` 账户、编辑 `config.json` 任务——在 CI 场景中分别由 **Secrets** 与 **`config.ci.json`** 承担，核心逻辑完全一致。

---

### 方式四 · Docker

适合 NAS、软路由、长期挂机等常驻场景。

```bash
cp env.example .env                      # 填入账号
cp config.example.json config/config.json
docker compose up -d
```

容器内使用 cron 定时执行，支持 `API_MODE=true` 开启控制 API 与可视化面板。

---

### 方式五 · 油猴脚本

`tampermonkey/` 目录中为油猴脚本，也可直接安装：

- [Microsoft Bing Rewards 每日任务脚本](https://greasyfork.org/zh-CN/scripts/477107)
- [移动端微软 Rewards 每日任务脚本](https://greasyfork.org/zh-CN/scripts/480355)

---

## 配置说明

### 账户配置

账户信息统一写在 `.env`（已在 `.gitignore` 中），通过 `ACCOUNT_<槽位>_<字段>` 命名：

```dotenv
ACCOUNT_1_EMAIL=email@example.com
ACCOUNT_1_PASSWORD=your_password
ACCOUNT_1_TOTP_SECRET=          # 2FA 密钥，留空表示不使用
ACCOUNT_1_GEO_LOCALE=CN         # 地区，auto 表示自动探测
ACCOUNT_1_LANG_CODE=zh-CN       # 语言
ACCOUNT_1_PROXY_HTTP=false
ACCOUNT_1_PROXY_URL=
ACCOUNT_1_PROXY_PORT=0
```

字段完整说明见 [env.example](./env.example)。槽位编号无需连续。

### 配置文件

`config.json` 为任务配置，字段说明见 [config.example.json](./config.example.json)。CI 环境使用 [config.ci.json](./config.ci.json)（`headless: true`、关闭需交互的模块）。

关键字段：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `headless` | `false` | 无头模式。CI 中强制为 `true` |
| `browserChannel` | `chromium` | 浏览器来源。Linux 下 `chrome`/`msedge` 会回退到内置 Chromium |
| `clusters` | `1` | 并发集群数。> 1 时退出码才反映账户失败 |
| `workers.*` | 见示例 | 各积分任务开关 |
| `searchSettings.queryEngines` | `china,local` | 查询源。国内推荐 |
| `searchSettings.searchDelay` | `30sec-1min` | 搜索间隔。调短会提高风控概率 |
| `webhook.wecom` | `enabled: false` | 企业微信推送配置 |

### 环境变量覆盖

任意配置项均可通过 `CONFIG_*` 环境变量覆盖，无需改动文件：

```bash
CONFIG_CLUSTERS=2 \
CONFIG_SEARCH_DELAY_MIN=30s \
CONFIG_SEARCH_DELAY_MAX=1min \
CONFIG_WECOM_ENABLED=true \
CONFIG_WECOM_WEBHOOK_KEY=<your-key> \
  node dist/util/ConfigEnvOverrides.js apply --config config.json
```

完整映射清单见 `node dist/util/ConfigEnvOverrides.js list`。

> 含凭证的路径（webhook key / token / sendKey / botToken / appkey）在打印时统一显示为 `"***"`，配置写入不受影响。

---

## 推送通知

配置在 `config.json` 的 `webhook` 段，或用 `CONFIG_*` 覆盖：

| 通道 | 配置项 | 说明 |
|---|---|---|
| 企业微信 | `webhook.wecom` | 群机器人，`webhookKey` 为 URL 中 `key=` 后的 UUID |
| Server 酱 | `webhook.serverchan` | `sendKey` 在 sct.ftqq.com 获取 |
| PushPlus | `webhook.pushplus` | `token` 在 pushplus.plus 获取 |
| 微信 ClawBot | `webhook.clawbot` | 需扫码登录，凭证存 `clawbot-auth.json` |
| Discord | `webhook.discord` | Webhook URL |
| Telegram | `webhook.telegram` | `botToken` + `chatId` |
| ntfy | `webhook.ntfy` | `url` + `topic` |

任务结束后自动推送**积分摘要**（状态、账户数、总收集积分、各账户明细与耗时）。推送失败不影响任务执行，任务成败仅由退出码决定。

> ⚠️ 所有 webhook 地址与 token 均为凭证，务必通过 Secrets 或环境变量注入，**禁止提交到仓库**。

---

## 项目结构

```
.
├── src/                      # 核心任务逻辑（TypeScript，跨平台）
│   ├── index.ts              # 入口
│   ├── browser/              # 浏览器与登录
│   ├── functions/            # 积分任务实现
│   ├── interface/            # 类型定义
│   ├── logging/              # 各推送渠道
│   └── util/                 # 配置加载、校验、HTTP 等
├── gui/                      # 桌面 GUI（Python + customtkinter）
├── scripts/
│   ├── api/                  # 控制 API
│   ├── docker/               # 容器入口与调度
│   └── main/                 # 辅助脚本
├── tampermonkey/             # 油猴脚本
├── .github/workflows/        # GitHub Actions 工作流
├── config.ci.json            # CI 配置模板
├── config.example.json       # 配置模板
├── env.example              # 账户模板
├── Dockerfile / compose.yaml # 容器编排
└── docs/github-actions.md    # CI 完整配置指南
```

---

## 常见问题

**Q：报 `Current Node.js version ... does not satisfy requirement: >=24.0.0`？**
A：需 Node.js 24+。`node -v` 确认。

**Q：Linux 上 `browserChannel: chrome` 不生效？**
A：Linux 无系统 Chrome/Edge，代码会自动回退到内置 Chromium（会打印警告），属预期行为。

**Q：CI 里如何判断任务成功与否？**
A：集群模式（`clusters > 1`）下失败退出码为 `1`；单集群模式退出码恒为 `0`，请查看日志 `RUN-END` 行或推送摘要中的「状态」字段。

**Q：任务很慢？**
A：搜索间隔默认 `30sec-1min`，乘以搜索次数后总时长较长。可调小 `searchSettings.searchDelay`，但间隔过短会显著提高风控概率。

**Q：CI 中每次都要重新登录？**
A：CI 实例是一次性的，`sessions/` 不保留。账号密码 + TOTP 可自动完成登录；如需长期保活建议用 Docker 方案。

**Q：定时任务没触发？**
A：GitHub schedule 使用 **UTC**，`0 23 * * *` 对应北京时间次日 07:00。仓库连续 60 天无活动会自动停用定时任务。

---

## 免责声明

- 本软件为非官方第三方工具，与 Microsoft Corporation 没有任何隶属、授权或背书关系，Microsoft / Microsoft Rewards / Bing 等名称与商标归微软所有
- 使用自动化脚本获取 Rewards 积分可能违反 Microsoft 服务条款，存在积分被清零、账号被限制功能或永久封禁的风险，请自行判断并承担后果
- 因使用或无法使用本软件造成的账号异常、积分损失、数据丢失或其它任何直接、间接损失，作者不承担任何责任
- 本项目仅供学习与技术交流，请优先使用微软官方服务

---

## License

本仓库包含基于 [Microsoft-Rewards-Script](https://github.com/TheNetsky/Microsoft-Rewards-Script)（GPL-3.0）的衍生代码，因此同样以 GPL-3.0 发布；`tampermonkey/` 下的油猴脚本为作者原创。完整许可证见 [LICENSE](./LICENSE)。
