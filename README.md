# Nintendo MCP

[简体中文](README.zh-CN.md) · [MIT license](LICENSE)

Search Nintendo UK's game catalogue, compare Switch and Switch 2 editions, and build a regional release calendar with links straight to Nintendo.

## Connect

Paste the following address into a remote MCP client and select **Streamable HTTP**. The public tools work without an API key or platform sign-in.

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

Start a new conversation in Codex or open `/mcp` in Claude Code to check the connection.

## Try it

> Find the Switch and Switch 2 editions of Tears of the Kingdom in the UK. Compare their release dates and listed prices, then show three upcoming Switch 2 games.

Use `system: "switch"` and `system: "switch2"` for the two searches. The original UK listing uses `game_id: "1576884"`. Keep each edition's catalogue ID for detail lookups.

## Tools

| Tool | Inputs | Returns |
| --- | --- | --- |
| `search_games` | `query`, `system`, `limit`, `offset` | Game IDs, UK pages and listed details for matching titles |
| `game_details` | `game_id` | Systems, release date, publisher, demo flag and listed GBP prices when available |
| `release_calendar` | `window`, `system`, `limit`, `offset` | Page through recent or upcoming UK releases in date order |

`all` includes legacy systems. `switch` and `switch2` filter the catalogue's hardware classifications. `recent` includes today and the previous 29 days. `upcoming` covers tomorrow through day 30. A missing price is `null`. Prices and demo flags reflect the UK catalogue, and final availability is shown on the eShop. Private Nintendo Account purchases and play activity are outside this connector's scope.

## How requests work

```mermaid
flowchart LR
    A["MCP client"] -->|HTTPS POST /mcp| B["Cloudflare Worker"]
    B --> C["MCP SDK + validated tools"]
    C -->|Public reads| D["Nintendo of Europe catalogue"]
```

All three tools read the Nintendo of Europe public catalogue's English index. The adapter restricts queries to game records, applies hardware and date filters, and projects a bounded set of fields. Each record carries a Nintendo UK page URL. The adapter caches successful catalogue reads for up to 15 minutes.

Each request gets its own MCP server and transport. Inputs are validated before any upstream request. The Worker returns structured JSON and a text representation for clients that read text results. Platform failures are reported as tool errors. The service uses no account database or platform credentials. Search terms and lookup identifiers are sent to the relevant platform to complete the request.

[Nintendo UK game directory](https://www.nintendo.com/en-gb/Games/Games-11598.html) · [Nintendo of Europe's public catalogue](https://search.nintendo-europe.com/en/select?q=zelda&fq=type%3AGAME&rows=1&wt=json)

## Run your own

Use Node.js 24 or later.

```sh
git clone https://github.com/oratis/nintendo-mcp.git
cd nintendo-mcp
npm ci
npm run check
npm test
npm run dev
```

In a second terminal, run the SDK smoke test. It negotiates the protocol, lists the tools and calls them against real platform data.

```sh
npm run smoke -- http://localhost:8787/mcp
```

`npm run smoke` without an argument checks the hosted service. `npm test` runs offline with fixture responses. To deploy, authenticate Wrangler with your Cloudflare account and run `npm run deploy`. Give clients the deployed Worker URL with `/mcp` appended.

## Connection checks

- A browser GET to `/mcp` returns HTTP 405. Open the [service information](https://nintendo-mcp.oratisoratisoratisoratis.workers.dev/) to check the hostname, or use the smoke test for an end-to-end check.
- An upstream error after successful tool discovery concerns the platform lookup. Check the identifier and region, then retry.

Community project maintained by [oratis](https://github.com/oratis). Related connectors · [Steam MCP](https://github.com/oratis/steam-mcp) · [PlayStation MCP](https://github.com/oratis/playstation-mcp).
