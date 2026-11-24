# Nintendo MCP

[English](README.md) · [MIT 许可证](LICENSE)

查询任天堂英国游戏目录，比较 Switch 与 Switch 2 版本的发行日、价格和试玩信息，还可以按机型查看近期发行日历。

## 直接连接

在支持远程 MCP 的客户端粘贴这个地址，传输方式选 **Streamable HTTP**。公开查询免登录，无需申请 API Key。

```text
https://nintendo-mcp.oratisoratisoratisoratis.workers.dev/mcp
```

**Codex**

```sh
codex mcp add nintendo --url https://nintendo-mcp.oratisoratisoratisoratis.workers.dev/mcp
```

**Claude Code**

```sh
claude mcp add --transport http --scope user nintendo https://nintendo-mcp.oratisoratisoratisoratis.workers.dev/mcp
```

配置后在 Codex 新开对话，或在 Claude Code 输入 `/mcp` 查看连接状态。

## 能连接我的 Nintendo Account 吗？

托管版目前**仅提供公开目录查询**。任天堂允许合作伙伴在用户同意后读取特定账户资料，例如昵称。任天堂自己的 Nintendo Store 应用可以显示游戏历史和游玩时长。当前 `oratis` 没有获批的合作伙伴应用，也没有购买记录或游玩活动权限。 [合作伙伴账户资料共享](https://en-americas-support.nintendo.com/app/answers/detail/a_id/27499/) · [Nintendo Store 游玩记录](https://www.nintendo.com/us/mobile-apps/nintendo-store/)

| 个人数据 | 本次验证结果 |
| --- | --- |
| 已购或拥有的游戏 | 无法读取。目录 ID 只标识商品。 |
| 成就 | 未验证到可供此连接器使用的全账号成就接口。 |
| 游玩时长及最近游玩时间 | 无法读取。此次没有取得玩家活动记录。 |

线上测试覆盖英国游戏目录和两个发行时间窗口。此次没有真实 Nintendo Account 授权或个人数据可供验证。任天堂还为符合条件的用户和接收方提供独立的数据申请流程，本服务尚未获授该渠道的实时访问权限。 [任天堂数据访问说明](https://www.nintendo.com/en-gb/Legal-information/Data-Act-2913095.html)

## 试一句

> 找到英国目录里的《王国之泪》Switch 和 Switch 2 版，比较发行日期与价格，再列出三款即将发售的 Switch 2 游戏。

分别传 `system: "switch"` 和 `system: "switch2"` 搜索英文名 `Tears of the Kingdom`。英国目录中原版的 `game_id` 为 `1576884`。两个版本的详情用各自的目录 ID 查询。

## 工具与数据范围

| 工具 | 参数 | 返回内容 |
| --- | --- | --- |
| `search_games` | `query`, `system`, `limit`, `offset` | 按英文关键词搜索，返回目录 ID、英国页面和基本资料 |
| `game_details` | `game_id` | 读取支持机型、发行日、发行商、试玩标记和已知英镑价格 |
| `release_calendar` | `window`, `system`, `limit`, `offset` | 按日期翻页查看近期已发行或即将发行的英国游戏 |

`all` 含旧机型，`switch` 和 `switch2` 按目录中的硬件分类筛选。`recent` 包括今天及之前 29 天，`upcoming` 从明天到第 30 天。未提供价格时返回 `null`。价格与试玩标记来自英国目录，购买时以 eShop 为准。此版本不读取 Nintendo Account 私人购买记录或游玩时长。

## 架构

每个请求在 Cloudflare Worker 中创建独立的 MCP 服务与 HTTP 传输。输入校验通过后才访问平台。客户端可以读取结构化 JSON 或等价的文本结果，上游异常会作为工具错误返回。

三个工具都读取 Nintendo of Europe 公开目录的英国英文索引。适配层只查询游戏记录，按机型和时间过滤，选取需要的字段。每条记录带英国官网链接，成功的目录查询最多缓存 15 分钟。

查询关键词或标识符会发送到相应平台。服务无需平台账号凭据或账户数据库。

[Nintendo UK game directory](https://www.nintendo.com/en-gb/Games/Games-11598.html) · [Nintendo of Europe's public catalogue](https://search.nintendo-europe.com/en/select?q=zelda&fq=type%3AGAME&rows=1&wt=json)

## 本地运行与自托管

需要 Node.js 24 或以上版本。

```sh
git clone https://github.com/oratis/nintendo-mcp.git
cd nintendo-mcp
npm ci
npm run check
npm test
npm run dev
```

在另一个终端运行端到端验证。脚本会完成 MCP 握手、发现工具，再调用真实平台数据。

```sh
npm run smoke -- http://localhost:8787/mcp
```

直接执行 `npm run smoke` 可验证公开服务。`npm test` 使用离线测试数据。自托管时登录自己的 Cloudflare 账户，执行 `npm run deploy`，把部署地址加上 `/mcp` 即可交给客户端。

## 常见连接问题

- 浏览器直接打开 `/mcp` 会收到 HTTP 405。查看[服务信息](https://nintendo-mcp.oratisoratisoratisoratis.workers.dev/)可确认地址，完整验证请用上面的 smoke 命令。
- 如果可以列出工具，但查询返回上游错误，请核对地区和标识符后重试。

由 [oratis](https://github.com/oratis) 独立维护。同系列连接器 · [Steam MCP](https://github.com/oratis/steam-mcp) · [PlayStation MCP](https://github.com/oratis/playstation-mcp)。
