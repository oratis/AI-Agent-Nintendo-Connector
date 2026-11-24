import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handler } from "../src/index.ts";
import { name } from "../src/platform.ts";

export async function withClient(upstream: typeof fetch, run: (client: Client) => Promise<void>) {
  const serve = handler(upstream);
  const client = new Client({ name: "test-client", version: "1" });
  const endpoint = new URL("https://test.invalid/mcp");
  const transport = new StreamableHTTPClientTransport(endpoint, {
    fetch: (url, init) => serve(new Request(url, init)),
  });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, name);
    await run(client);
  } finally {
    await client.close();
  }
}

test("remote SDK client negotiates and discovers read-only tools without platform calls", async () => {
  await withClient(
    () => {
      throw new Error("unexpected fetch");
    },
    async (client) => {
      const { tools } = await client.listTools();
      assert.ok(tools.length >= 3);
      assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));
    }
  );
});

test("HTTP routing rejects foreign origins and does not open idle streams", async () => {
  const serve = handler(fetch);
  const endpoint = "https://test.invalid/mcp";
  assert.equal(
    (
      await serve(
        new Request(endpoint, { method: "POST", headers: { origin: "https://other.invalid" } })
      )
    ).status,
    403
  );
  assert.equal((await serve(new Request(endpoint))).status, 405);
  assert.equal((await serve(new Request(endpoint + "/bad"))).status, 404);
});

test("invalid arguments are rejected before querying the platform", async () => {
  let calls = 0;
  await withClient(
    async () => {
      calls++;
      return new Response();
    },
    async (client) => {
      const response = await client.callTool({
        name: "game_details",
        arguments: { game_id: "../../bad" },
      });
      assert.equal(response.isError, true);
      assert.equal(calls, 0);
    }
  );
});

test("upstream throttling is actionable and does not echo the body", async () => {
  await withClient(
    async () => new Response("debug details", { status: 429 }),
    async (client) => {
      const response = await client.callTool({
        name: "game_details",
        arguments: { game_id: "1576884" },
      });
      assert.equal(response.isError, true);
      const text = JSON.stringify(response.content);
      assert.match(text, /429/);
      assert.doesNotMatch(text, /debug details/);
    }
  );
});

test("catalogue pagination, system filter, and missing-price sentinel", async () => {
  await withClient(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("q"), "zelda");
      assert.match(url.searchParams.get("fq")!, /system_type:nintendoswitch2/);
      return Response.json({
        response: {
          numFound: 4,
          docs: [
            {
              fs_id: "123",
              title: "Zelda",
              url: "/en-gb/Games/Zelda-123.html",
              price_lowest_f: -1,
            },
          ],
        },
      });
    },
    async (client) => {
      const response = await client.callTool({
        name: "search_games",
        arguments: { query: "Zelda", system: "switch2", offset: 1, limit: 1 },
      });
      assert.equal(response.structuredContent?.next_offset, 2);
      const first = (
        response.structuredContent?.games as { listed_lowest_price: number | null }[]
      )[0];
      assert.equal(first.listed_lowest_price, null);
    }
  );
});
