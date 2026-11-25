/**
 * Cloudflare Pages Function: /api/messages
 *
 * Stores confirmed inbound contact form submissions from index.html (#siteEmailForm)
 * in Cloudflare KV (binding: TWJ_MESSAGES) and serves them to admin.html.
 *
 * Required Cloudflare Pages Binding:
 *   KV Namespace Binding Name: TWJ_MESSAGES
 *
 * Optional Environment Variable:
 *   ADMIN_HASH (SHA-256 hex of admin passcode; defaults to admin.html's ADMIN_HASH)
 */

const DEFAULT_ADMIN_HASH =
  "a1b537b10d5d1d0fa6643a0ff091d29389ce71538cbfc4a409b1474a0d1fdc14";
const KV_KEY = "inbox_messages_v1";
const MAX_MESSAGES = 500;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(request, env) {
  const expected = (env.ADMIN_HASH || DEFAULT_ADMIN_HASH).trim().toLowerCase();
  const sessionHeader = (request.headers.get("X-Admin-Session") || "")
    .trim()
    .toLowerCase();
  const authHeader = (request.headers.get("Authorization") || "").trim();
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim().toLowerCase()
    : "";
  return Boolean(expected && (sessionHeader === expected || bearer === expected));
}

async function readInbox(kv) {
  const raw = await kv.get(KV_KEY, "json");
  return Array.isArray(raw) ? raw : [];
}

export async function onRequestGet({ request, env }) {
  if (!env.TWJ_MESSAGES) {
    return jsonResponse(
      {
        ok: false,
        error: "KV_NOT_BOUND",
        message:
          "Cloudflare KV binding TWJ_MESSAGES is not configured yet in Pages Settings -> Functions.",
      },
      503
    );
  }
  if (!isAuthorized(request, env)) {
    return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const messages = await readInbox(env.TWJ_MESSAGES);
  const unreadCount = messages.filter((m) => m.status === "received").length;
  return jsonResponse({
    ok: true,
    updatedAt: new Date().toISOString(),
    totalCount: messages.length,
    unreadCount,
    messages,
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.TWJ_MESSAGES) {
    return jsonResponse(
      {
        ok: false,
        error: "KV_NOT_BOUND",
        message: "Cloudflare KV binding TWJ_MESSAGES is not configured yet.",
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const name = String(body?.name || "").trim().slice(0, 120);
  const email = String(body?.email || "").trim().slice(0, 160);
  const city = String(body?.city || "Not specified").trim().slice(0, 120);
  const offer = String(body?.offer || "General").trim().slice(0, 120);
  const message = String(body?.message || "").trim().slice(0, 4000);

  if (!name || !email || !email.includes("@") || !message) {
    return jsonResponse(
      {
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Name, valid email, and message are required.",
      },
      400
    );
  }

  const entry = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    email,
    city,
    offer,
    message,
    channel: "Website Form",
    status: "received",
    confirmed: true,
    createdAt: new Date().toISOString(),
  };

  const messages = await readInbox(env.TWJ_MESSAGES);
  messages.unshift(entry);
  if (messages.length > MAX_MESSAGES) {
    messages.length = MAX_MESSAGES;
  }
  await env.TWJ_MESSAGES.put(KV_KEY, JSON.stringify(messages));

  return jsonResponse(
    {
      ok: true,
      id: entry.id,
      createdAt: entry.createdAt,
    },
    201
  );
}

export async function onRequestPatch({ request, env }) {
  if (!env.TWJ_MESSAGES) {
    return jsonResponse({ ok: false, error: "KV_NOT_BOUND" }, 503);
  }
  if (!isAuthorized(request, env)) {
    return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const id = String(body?.id || "").trim();
  const nextStatus = String(body?.status || "").trim();
  if (!id || !["received", "read", "replied", "archived"].includes(nextStatus)) {
    return jsonResponse({ ok: false, error: "INVALID_STATUS" }, 400);
  }

  const messages = await readInbox(env.TWJ_MESSAGES);
  const target = messages.find((m) => m.id === id);
  if (!target) {
    return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  }

  target.status = nextStatus;
  target.updatedAt = new Date().toISOString();
  await env.TWJ_MESSAGES.put(KV_KEY, JSON.stringify(messages));

  return jsonResponse({ ok: true, id, status: nextStatus });
}
