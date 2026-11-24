import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(
  process.argv[2] ?? "https://nintendo-mcp.oratisoratisoratisoratis.workers.dev/mcp"
);
const client = new Client({ name: "connector-smoke", version: "1" });

async function call(name, args) {
  const response = await client.callTool({ name, arguments: args });
  assert.ok(!response.isError, name + " failed: " + JSON.stringify(response.content));
  assert.ok(response.structuredContent, name + " returned no structured data");
  console.log("OK", name);
  return response.structuredContent;
}

try {
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  assert.equal(client.getServerVersion()?.name, "nintendo-mcp");
  const { tools } = await client.listTools();
  console.log(endpoint.href, tools.map((t) => t.name).join(", "));
  const list = await call("search_games", {
    query: "Tears of the Kingdom",
    system: "switch",
    limit: 5,
  });
  assert.ok(list.games.some((g) => g.game_id === "1576884"));
  const game = await call("game_details", { game_id: "1576884" });
  assert.match(game.game.title, /Tears of the Kingdom/i);
  for (const window of ["recent", "upcoming"]) {
    const releases = await call("release_calendar", { window, system: "switch2", limit: 2 });
    assert.ok(Array.isArray(releases.games) && releases.games.length <= 2);
    assert.ok(releases.games.every((g) => g.systems.includes("Nintendo Switch 2")));
  }
} finally {
  await client.close();
}
