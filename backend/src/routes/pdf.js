const express = require("express");
const PDFDocument = require("pdfkit");
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const STATUS_COLOR = {
  completed: "#22c55e",
  passed: "#22c55e",
  failed: "#ef4444",
  in_progress: "#f59e0b",
  pending: "#94a3b8",
  skipped: "#64748b",
  approved: "#3b82f6",
  rolled_back: "#f97316",
};

function statusIcon(status) {
  const icons = {
    completed: "✓",
    passed: "✓",
    failed: "✗",
    in_progress: "▶",
    pending: "○",
    skipped: "—",
    approved: "★",
    rolled_back: "↩",
  };
  return icons[status] || "?";
}

// GET /api/pdf/:cr_id
router.get("/:cr_id", async (req, res) => {
  const { cr_id } = req.params;

  try {
    const [crResult, cpResult, stResult, evResult, imgResult] = await Promise.all([
      pool.query(
        `
        SELECT cr.*, u.full_name AS created_by_name
        FROM change_requests cr LEFT JOIN users u ON u.id = cr.created_by
        WHERE cr.id = $1
      `,
        [cr_id],
      ),
      pool.query(
        `
        SELECT cp.*, ua.full_name AS assigned_to_name, uc.full_name AS completed_by_name
        FROM checkpoints cp
        LEFT JOIN users ua ON ua.id = cp.assigned_to
        LEFT JOIN users uc ON uc.id = cp.completed_by
        WHERE cp.cr_id = $1 ORDER BY cp.order_index
      `,
        [cr_id],
      ),
      pool.query(
        `
        SELECT ds.*, ua.full_name AS assigned_to_name, ue.full_name AS executed_by_name
        FROM deployment_steps ds
        LEFT JOIN users ua ON ua.id = ds.assigned_to
        LEFT JOIN users ue ON ue.id = ds.executed_by
        WHERE ds.cr_id = $1 ORDER BY ds.step_number
      `,
        [cr_id],
      ),
      pool.query(
        `
        SELECT de.*, u.full_name AS user_name
        FROM deployment_events de LEFT JOIN users u ON u.id = de.user_id
        WHERE de.cr_id = $1 ORDER BY de.created_at ASC
      `,
        [cr_id],
      ),
      pool.query(
        `SELECT e.id, e.filename, e.file_type, e.file_size_kb, e.data, e.uploaded_at,
                u.full_name AS uploaded_by_name
         FROM deployment_evidence e LEFT JOIN users u ON u.id = e.uploaded_by
         WHERE e.cr_id = $1 ORDER BY e.uploaded_at ASC`,
        [cr_id],
      ),
    ]);

    if (!crResult.rows.length)
      return res.status(404).json({ error: "Change request not found" });

    const cr = crResult.rows[0];
    const checkpoints = cpResult.rows;
    const steps = stResult.rows;
    const events = evResult.rows;

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="deployment-report-${cr.cr_number}.pdf"`,
    );
    doc.pipe(res);

    // ── HELPERS ──────────────────────────────────────────────────────
    const pageW =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    function sectionTitle(text) {
      doc.moveDown(0.5);
      doc.rect(doc.page.margins.left, doc.y, pageW, 22).fill("#1e293b");
      doc
        .fillColor("#f8fafc")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(text, doc.page.margins.left + 8, doc.y - 17, {
          width: pageW - 16,
        });
      doc.fillColor("#0f172a").font("Helvetica").fontSize(10);
      doc.moveDown(0.6);
    }

    function kv(label, value, opts = {}) {
      if (value === null || value === undefined || value === "") return;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#475569")
        .text(`${label}:`, { continued: true });
      doc.font("Helvetica").fillColor("#0f172a").text(`  ${value}`, opts);
    }

    function badge(text, color, x, y) {
      const tw = doc.widthOfString(text) + 10;
      doc.roundedRect(x, y, tw, 14, 3).fill(color);
      doc
        .fillColor("#fff")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(text, x + 5, y + 3, { lineBreak: false });
      doc.fillColor("#0f172a").font("Helvetica").fontSize(9);
      return tw;
    }

    function formatDate(d) {
      if (!d) return "-";
      return new Date(d).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }

    // ── COVER HEADER ──────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill("#0f172a");
    doc
      .fillColor("#f8fafc")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("DEPLOYMENT REPORT", 50, 22, {
        align: "center",
        width: doc.page.width - 100,
      });
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#94a3b8")
      .text("SRE Deployment Manager", 50, 48, {
        align: "center",
        width: doc.page.width - 100,
      });
    doc.fillColor("#0f172a");
    doc.y = 110;

    // ── CHANGE REQUEST INFO ───────────────────────────────────────────
    sectionTitle("CHANGE REQUEST INFORMATION");
    kv("CR Number", cr.cr_number);
    kv("Title", cr.title);
    kv("Description", cr.description);
    kv("Type", cr.change_type);
    kv("Priority", cr.priority?.toUpperCase());
    kv("Environment", cr.environment?.toUpperCase());
    kv("Affected Systems", (cr.affected_systems || []).join(", "));
    kv("Scheduled Start", formatDate(cr.scheduled_start));
    kv("Scheduled End", formatDate(cr.scheduled_end));
    kv("CAB Approved By", cr.cab_approved_by);
    kv("CAB Approved At", formatDate(cr.cab_approved_at));
    kv("Created By", cr.created_by_name);
    kv("Rollback Plan", cr.rollback_plan);

    const statusColor = STATUS_COLOR[cr.status] || "#94a3b8";
    const bx = doc.page.margins.left;
    const by = doc.y + 4;
    badge(`STATUS: ${(cr.status || "").toUpperCase()}`, statusColor, bx, by);
    doc.moveDown(1.5);

    // ── CHECKPOINTS ───────────────────────────────────────────────────
    if (checkpoints.length) {
      sectionTitle("PRE-DEPLOYMENT CHECKPOINTS");
      checkpoints.forEach((cp, i) => {
        const color = STATUS_COLOR[cp.status] || "#94a3b8";
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#0f172a")
          .text(`${i + 1}. ${statusIcon(cp.status)}  ${cp.name}`, {
            continued: false,
          });
        doc.font("Helvetica").fontSize(9).fillColor("#475569");
        if (cp.team)
          doc.text(
            `   Team: ${cp.team}   |   Assigned: ${cp.assigned_to_name || "-"}   |   Status: ${cp.status}`,
          );
        if (cp.notes) doc.text(`   Notes: ${cp.notes}`);
        if (cp.completed_at)
          doc.text(
            `   Completed: ${formatDate(cp.completed_at)} by ${cp.completed_by_name || "-"}`,
          );
        doc.moveDown(0.3);
      });
      doc.moveDown(0.5);
    }

    // ── DEPLOYMENT STEPS ──────────────────────────────────────────────
    if (steps.length) {
      sectionTitle("DEPLOYMENT STEPS (RUNBOOK)");
      steps.forEach((s) => {
        const color = STATUS_COLOR[s.status] || "#94a3b8";
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#0f172a")
          .text(`Step ${s.step_number}. ${statusIcon(s.status)}  ${s.title}`);
        doc.font("Helvetica").fontSize(9).fillColor("#475569");
        if (s.description) doc.text(`   ${s.description}`);
        if (s.command) {
          doc
            .rect(doc.page.margins.left + 8, doc.y, pageW - 16, 14)
            .fill("#f1f5f9");
          doc
            .fillColor("#0f172a")
            .font("Courier")
            .fontSize(8)
            .text(`   $ ${s.command}`, doc.page.margins.left + 12, doc.y - 11, {
              width: pageW - 24,
            });
          doc.font("Helvetica").fontSize(9).fillColor("#475569");
          doc.moveDown(0.2);
        }
        const meta = [
          s.assigned_to_name ? `Assigned: ${s.assigned_to_name}` : null,
          `Status: ${s.status}`,
          s.started_at ? `Started: ${formatDate(s.started_at)}` : null,
          s.completed_at ? `Done: ${formatDate(s.completed_at)}` : null,
          s.executed_by_name ? `Executed by: ${s.executed_by_name}` : null,
        ]
          .filter(Boolean)
          .join("   |   ");
        if (meta) doc.text(`   ${meta}`);
        if (s.notes)
          doc.fillColor("#dc2626").text(`   ⚠ ${s.notes}`).fillColor("#475569");
        doc.moveDown(0.4);
      });
    }

    // ── DEPLOYMENT EVENT LOG ──────────────────────────────────────────
    if (events.length) {
      sectionTitle("DEPLOYMENT EVENT LOG");
      events.forEach((ev) => {
        const colors = {
          error: "#ef4444",
          warning: "#f59e0b",
          success: "#22c55e",
          info: "#64748b",
        };
        const c = colors[ev.severity] || "#64748b";
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(c)
          .text(`[${formatDate(ev.created_at)}] `, { continued: true });
        doc
          .font("Helvetica")
          .fillColor("#0f172a")
          .text(`${ev.user_name || "system"}: ${ev.message}`);
      });
      doc.moveDown(0.5);
    }

    // ── SUMMARY BOX ───────────────────────────────────────────────────
    sectionTitle("DEPLOYMENT SUMMARY");
    const total = steps.length;
    const done = steps.filter((s) => s.status === "completed").length;
    const failed = steps.filter((s) => s.status === "failed").length;
    const cpPassed = checkpoints.filter((c) => c.status === "passed").length;
    const cpTotal = checkpoints.length;

    doc
      .rect(doc.page.margins.left, doc.y, pageW, 60)
      .fill("#f8fafc")
      .stroke("#e2e8f0");
    const sy = doc.y - 55;
    doc.font("Helvetica").fontSize(10).fillColor("#0f172a");
    doc.text(
      `Checkpoints Passed : ${cpPassed} / ${cpTotal}`,
      doc.page.margins.left + 12,
      sy + 8,
    );
    doc.text(
      `Steps Completed    : ${done} / ${total}`,
      doc.page.margins.left + 12,
      sy + 22,
    );
    doc.text(
      `Steps Failed       : ${failed}`,
      doc.page.margins.left + 12,
      sy + 36,
    );
    const finalStatus = cr.status?.toUpperCase() || "UNKNOWN";
    const fColor = STATUS_COLOR[cr.status] || "#94a3b8";
    doc
      .font("Helvetica-Bold")
      .fillColor(fColor)
      .text(
        `Final Status: ${finalStatus}`,
        doc.page.margins.left + 12,
        sy + 50,
      );
    doc.moveDown(4.5);

    // ── DIGITAL SIGNATURE ─────────────────────────────────────────────
    if (cr.signature_data) {
      sectionTitle("TANDA TANGAN DIGITAL APPROVER");
      try {
        // signature_data is "data:image/png;base64,<data>"
        const base64 = cr.signature_data.replace(/^data:image\/\w+;base64,/, "");
        const imgBuf = Buffer.from(base64, "base64");
        const sigX = doc.page.margins.left;
        const sigY = doc.y + 4;
        doc.image(imgBuf, sigX, sigY, { width: 200, height: 80 });
        doc.moveDown(6);
        doc
          .font("Helvetica-Bold").fontSize(9).fillColor("#0f172a")
          .text(`Disetujui oleh: ${cr.signature_name || "-"}`, doc.page.margins.left);
        doc
          .font("Helvetica").fontSize(9).fillColor("#475569")
          .text(`Waktu approval: ${formatDate(cr.signature_at)}`);
        doc.moveDown(0.5);
      } catch (sigErr) {
        doc.font("Helvetica").fontSize(9).fillColor("#ef4444")
          .text("[Tanda tangan tidak dapat ditampilkan]");
        doc.moveDown(0.5);
      }
    }

    // ── FOOTER ────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .fillColor("#94a3b8")
      .font("Helvetica")
      .text(
        `Generated by SRE Deployment Manager  •  ${new Date().toLocaleString("id-ID")}`,
        { align: "center" },
      );
    // ── EVIDENCE PAGE ─────────────────────────────────────────────────────
    const evidenceRows = imgResult.rows;
    if (evidenceRows.length > 0) {
      doc.addPage();

      // Dark header banner
      doc.rect(0, 0, doc.page.width, 70).fill("#0f172a");
      doc
        .fillColor("#f8fafc")
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("DEPLOYMENT EVIDENCE", 50, 18, {
          align: "center",
          width: doc.page.width - 100,
        });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#94a3b8")
        .text(`${evidenceRows.length} screenshot`, 50, 42, {
          align: "center",
          width: doc.page.width - 100,
        });
      doc.fillColor("#0f172a");

      const IMG_W = 228;
      const IMG_H = 145;
      const COL_GAP = 20;
      const CAPTION_H = 26;
      const ROW_GAP = 14;
      const leftM = doc.page.margins.left;
      let curY = 84;

      for (let i = 0; i < evidenceRows.length; i += 2) {
        const rowTotal = IMG_H + CAPTION_H + ROW_GAP;
        // New page if not enough space
        if (curY + rowTotal > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          curY = doc.page.margins.top;
        }

        for (let c = 0; c < 2 && i + c < evidenceRows.length; c++) {
          const ev = evidenceRows[i + c];
          const x = leftM + c * (IMG_W + COL_GAP);

          // Draw image
          try {
            const base64 = ev.data.replace(/^data:image\/\w+;base64,/, "");
            const imgBuf = Buffer.from(base64, "base64");
            doc.image(imgBuf, x, curY, {
              width: IMG_W,
              height: IMG_H,
              fit: [IMG_W, IMG_H],
              align: "center",
              valign: "center",
            });
          } catch {
            doc.rect(x, curY, IMG_W, IMG_H).fill("#f1f5f9").stroke("#e2e8f0");
            doc
              .fillColor("#94a3b8")
              .fontSize(8)
              .text("[Gambar tidak dapat ditampilkan]", x + 10, curY + 62, {
                width: IMG_W - 20,
              });
          }

          // Border
          doc.rect(x, curY, IMG_W, IMG_H).stroke("#e2e8f0");

          // Caption
          const capY = curY + IMG_H + 4;
          doc
            .fillColor("#0f172a")
            .font("Helvetica-Bold")
            .fontSize(8)
            .text(ev.filename || `Evidence ${i + c + 1}`, x, capY, {
              width: IMG_W,
              lineBreak: false,
            });
          doc
            .font("Helvetica")
            .fillColor("#64748b")
            .fontSize(7)
            .text(
              `${ev.file_size_kb || 0} KB  ·  ${ev.uploaded_by_name || "-"}  ·  ${formatDate(ev.uploaded_at)}`,
              x,
              capY + 11,
              { width: IMG_W, lineBreak: false },
            );
        }

        curY += rowTotal;
      }

      // Page footer
      doc.y = Math.min(curY + 10, doc.page.height - doc.page.margins.bottom - 20);
      doc
        .fontSize(8)
        .fillColor("#94a3b8")
        .font("Helvetica")
        .text(
          `Generated by SRE Deployment Manager  •  ${new Date().toLocaleString("id-ID")}`,
          { align: "center" },
        );
    }
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent)
      res.status(500).json({ error: "PDF generation failed" });
  }
});

module.exports = router;
