// Zero-dependency Notion -> data/travel-sync.json sync (public-safe fields only)
import fs from "node:fs";
import path from "node:path";

const token = process.env.NOTION_TOKEN;
const pageIds = (process.env.NOTION_PAGE_IDS || "420c964a-136c-8101-9122-f055a454174e")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const OUT_PATH = path.resolve("data/travel-sync.json");

if (!token) {
  console.log("NOTION_TOKEN secret not set yet — skipping remote fetch and keeping existing data/travel-sync.json.");
  process.exit(0);
}

const SENSITIVE_RE = /\b(passport|booking\s*ref|pnr|confirmation\s*#|street\s*address|bank|iban|cvv)\b/i;

async function notionFetch(endpoint) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw new Error(`Notion API ${endpoint} failed: ${res.status}`);
  }
  return res.json();
}

function extractText(richText = []) {
  return richText.map((t) => t.plain_text || "").join("").trim();
}

async function fetchPageSummary(pageId) {
  const page = await notionFetch(`/pages/${pageId}`);
  const titleProp = Object.values(page.properties || {}).find((p) => p.type === "title");
  const title = titleProp ? extractText(titleProp.title) : "Notion Travel Page";

  const blocks = await notionFetch(`/blocks/${pageId}/children?page_size=50`);
  const items = [];
  for (const b of blocks.results || []) {
    const content = b[b.type]?.rich_text ? extractText(b[b.type].rich_text) : "";
    if (!content || SENSITIVE_RE.test(content)) continue;
    items.push({ type: b.type, text: content });
  }
  return {
    id: pageId,
    title,
    lastEdited: page.last_edited_time,
    items: items.slice(0, 30)
  };
}

const pages = [];
for (const id of pageIds) {
  try {
    pages.push(await fetchPageSummary(id));
  } catch (err) {
    console.error(`Failed page ${id}:`, err.message);
  }
}

const payload = {
  syncedAt: new Date().toISOString(),
  schedule: "Every 24 hours (06:00 UTC)",
  privacy: "Public-safe travel summaries only (sensitive patterns filtered)",
  pages
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");
console.log(`Synced ${pages.length} Notion page(s) to ${OUT_PATH}`);
