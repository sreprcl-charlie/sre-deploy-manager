/**
 * Ivanti HEAT Change sync service
 * Polls every 5 minutes and upserts all changes into ivanti_changes table.
 *
 * Required env vars:
 *   IVANTI_BASE_URL  — e.g. http://ivanti.local.altodev.id/HEAT/api/odata/businessobject/changes
 *   IVANTI_API_KEY   — REST API key
 */

const http = require("http");
const https = require("https");
const pool = require("../db/pool");

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 100; // Ivanti max records per request
const PAGE_DELAY_MS = 500; // delay antar halaman agar tidak rate-limited

// ── HTTP helper ──────────────────────────────────────────────────────────────

function httpGet(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${urlStr}`));
    }

    const lib = url.protocol === "https:" ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers,
      },
      timeout: 30000,
    };

    const req = lib.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          return reject(
            new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 200)}`),
          );
        }
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out after 30s"));
    });
    req.end();
  });
}

// ── Fetch all pages ──────────────────────────────────────────────────────────

async function fetchAllChanges() {
  const baseUrl = process.env.IVANTI_BASE_URL;
  const apiKey = process.env.IVANTI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "IVANTI_BASE_URL and IVANTI_API_KEY must be set in environment variables",
    );
  }

  const authHeaders = { Authorization: `rest_api_key=${apiKey}` };
  const all = [];
  let skip = 0;

  while (true) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}$top=${PAGE_SIZE}&$skip=${skip}&$format=json`;

    const data = await httpGet(url, authHeaders);
    const items = data.value || [];
    all.push(...items);

    // OData: if fewer items than page size, we're done
    if (items.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;

    // Delay sebelum request halaman berikutnya
    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }

  return all;
}

// ── Upsert into DB ───────────────────────────────────────────────────────────

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function upsertChanges(changes) {
  if (changes.length === 0) return;

  const client = await pool.connect();
  try {
    for (const c of changes) {
      await client.query(
        `INSERT INTO ivanti_changes (
           change_id, change_number, subject, status, priority, urgency,
           category, service, change_type, requested_by, owner, owner_team,
           scheduled_start, scheduled_end, description, reason,
           raw_data, created_at_ivanti, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
         ON CONFLICT (change_id) DO UPDATE SET
           change_number     = EXCLUDED.change_number,
           subject           = EXCLUDED.subject,
           status            = EXCLUDED.status,
           priority          = EXCLUDED.priority,
           urgency           = EXCLUDED.urgency,
           category          = EXCLUDED.category,
           service           = EXCLUDED.service,
           change_type       = EXCLUDED.change_type,
           requested_by      = EXCLUDED.requested_by,
           owner             = EXCLUDED.owner,
           owner_team        = EXCLUDED.owner_team,
           scheduled_start   = EXCLUDED.scheduled_start,
           scheduled_end     = EXCLUDED.scheduled_end,
           description       = EXCLUDED.description,
           reason            = EXCLUDED.reason,
           raw_data          = EXCLUDED.raw_data,
           synced_at         = NOW()`,
        [
          c.RecId || c.ChangeId || c.Id,
          c.ChangeNumber || c.Number || null,
          c.Subject || c.Title || null,
          c.Status || null,
          c.Priority || null,
          c.Urgency || null,
          c.Category || null,
          c.Service || null,
          c.TypeOfChange || c.ChangeType || null,
          c.ProfileFullName || c.RequestedBy || null,
          c.Owner || null,
          c.OwnerTeam || null,
          parseDate(c.ScheduledStartDate || c.ScheduledStart),
          parseDate(c.ScheduledEndDate || c.ScheduledEnd),
          c.Description || null,
          c.ReasonForChange || c.Reason || null,
          JSON.stringify(c),
          parseDate(c.CreatedDateTime || c.CreatedDate),
        ],
      );
    }
  } finally {
    client.release();
  }
}

// ── Main sync ────────────────────────────────────────────────────────────────

let lastSyncResult = { status: "pending", synced: 0, lastRun: null, error: null };

async function sync() {
  console.log("[ivantiSync] Starting sync...");
  try {
    const changes = await fetchAllChanges();
    await upsertChanges(changes);
    lastSyncResult = {
      status: "ok",
      synced: changes.length,
      lastRun: new Date().toISOString(),
      error: null,
    };
    console.log(`[ivantiSync] ✓ Synced ${changes.length} changes from Ivanti`);
  } catch (err) {
    lastSyncResult = {
      status: "error",
      synced: 0,
      lastRun: new Date().toISOString(),
      error: err.message,
    };
    console.error("[ivantiSync] ✗ Sync failed:", err.message);
  }
}

function startSync() {
  // Run immediately, then on interval
  sync();
  setInterval(sync, SYNC_INTERVAL_MS);
}

function getSyncStatus() {
  return lastSyncResult;
}

module.exports = { startSync, sync, getSyncStatus };
