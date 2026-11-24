import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { annotations, limit, PublicSource, result, SourceError } from "./source.ts";

export const name = "nintendo-mcp";
export const instructions =
  "Read Nintendo UK's public game catalogue. Prices are catalogue observations in GBP. Dates use the UK release schedule. Cite the Nintendo game page for each result. Personal Nintendo Account authorization is unavailable in this deployment. Purchase history, personal achievements and account play activity are unavailable.";
const system = z.enum(["switch", "switch2", "all"]).default("all");
type System = z.output<typeof system>;
const offset = z.number().int().min(0).max(10000).default(0);
const gameId = z.string().regex(/^\d{1,10}$/);
const game = z.object({
  fs_id: gameId,
  title: z.string(),
  url: z.string().regex(/^\/en-gb\/Games\//i),
  pretty_date_s: z.string().optional(),
  system_names_txt: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  developer: z.string().optional(),
  pretty_game_categories_txt: z.array(z.string()).optional(),
  pretty_agerating_s: z.string().optional(),
  players_from: z.number().optional(),
  players_to: z.number().optional(),
  players_tbd_b: z.boolean().optional(),
  demo_availability: z.boolean().optional(),
  eshop_removed_b: z.boolean().optional(),
  price_regular_f: z.number().optional(),
  price_lowest_f: z.number().optional(),
});
const catalog = z.object({
  response: z.object({ numFound: z.number().int().nonnegative(), docs: z.array(game) }),
});
const systemFilters = {
  all: "",
  switch: " AND system_type:nintendoswitch_*",
  switch2: " AND system_type:nintendoswitch2*",
};

async function lookup(
  source: PublicSource,
  query: string,
  system: System,
  rows: number,
  start: number,
  releaseWindow?: "recent" | "upcoming"
) {
  const url = new URL("https://search.nintendo-europe.com/en/select");
  let filter = "type:GAME" + systemFilters[system];
  if (releaseWindow === "recent") filter += " AND dates_released_dts:[NOW/DAY-29DAYS TO NOW/DAY]";
  if (releaseWindow === "upcoming") filter += " AND dates_released_dts:{NOW/DAY TO NOW/DAY+30DAYS]";
  const sort = releaseWindow
    ? "dates_released_dts " + (releaseWindow === "recent" ? "desc" : "asc") + ",fs_id asc"
    : "score desc,fs_id asc";
  url.search = new URLSearchParams({
    q: query,
    fq: filter,
    sort,
    rows: String(rows),
    start: String(start),
    fl: Object.keys(game.shape).join(","),
    wt: "json",
  }).toString();
  const { response } = await source.json(url, catalog, 900);
  const games = response.docs.map((g) => ({
    game_id: g.fs_id,
    title: g.title,
    systems: g.system_names_txt,
    uk_release: g.pretty_date_s,
    publisher: g.publisher,
    developer: g.developer,
    genres: g.pretty_game_categories_txt,
    age_rating: g.pretty_agerating_s,
    players: g.players_tbd_b ? null : { min: g.players_from, max: g.players_to },
    demo_listed: g.demo_availability,
    eshop_removed: g.eshop_removed_b,
    currency: "GBP",
    regular_price:
      g.price_regular_f !== undefined && g.price_regular_f >= 0 ? g.price_regular_f : null,
    listed_lowest_price:
      g.price_lowest_f !== undefined && g.price_lowest_f >= 0 ? g.price_lowest_f : null,
    url: new URL(g.url, "https://www.nintendo.com").href,
  }));
  const next = start + games.length;
  return {
    region: "GB",
    source: url.href,
    total: response.numFound,
    offset: start,
    next_offset: games.length && next < response.numFound && next <= 10000 ? next : null,
    games,
  };
}

export function install(server: McpServer, source: PublicSource) {
  server.registerTool(
    "search_games",
    {
      description:
        "Search Nintendo UK's catalogue by words in a game title. Optionally restrict results to Switch or Switch 2.",
      annotations,
      inputSchema: { query: z.string().trim().min(1).max(100), system, limit, offset },
    },
    (args) =>
      result(async () => {
        const words = args.query.toLowerCase().match(/[\p{L}\p{N}]+/gu);
        if (!words) throw new SourceError("Enter a game title containing letters or numbers.");
        return lookup(source, words.join(" "), args.system, args.limit, args.offset);
      })
  );

  server.registerTool(
    "game_details",
    {
      description:
        "Read a Nintendo UK catalogue record by game_id, including systems, release date, demo and price when listed.",
      annotations,
      inputSchema: { game_id: gameId },
    },
    ({ game_id }) =>
      result(async () => {
        const found = await lookup(source, "fs_id:" + game_id, "all", 1, 0);
        const game = found.games[0];
        if (!game || game.game_id !== game_id)
          throw new SourceError("Nintendo UK has no game with this catalogue ID.");
        return { region: found.region, source: game.url, game };
      })
  );

  server.registerTool(
    "release_calendar",
    {
      description:
        "List UK game releases across a 30-day window. Recent includes today. Upcoming starts tomorrow. Use next_offset to page.",
      annotations,
      inputSchema: { window: z.enum(["recent", "upcoming"]), system, limit, offset },
    },
    (args) =>
      result(async () => ({
        window: args.window,
        ...(await lookup(source, "*:*", args.system, args.limit, args.offset, args.window)),
      }))
  );
}
