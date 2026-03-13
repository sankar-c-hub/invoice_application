/* ═══════════════════════════════════════
   routes/invoices.js
   All GitHub API calls are made here on
   the server — the token never reaches
   the browser.
═══════════════════════════════════════ */
const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();

// ── GitHub config from .env ─────────────
const GH_OWNER = process.env.GH_OWNER;
const GH_REPO  = process.env.GH_REPO;
const GH_FILE  = process.env.GH_FILE;
const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_API   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;

const GH_HEADERS = {
  Authorization: `token ${GH_TOKEN}`,
  Accept:        'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};

// ── Helper: fetch raw invoices + sha from GitHub ──
async function fetchFromGitHub() {
  const res = await fetch(GH_API, { headers: GH_HEADERS });
  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
  const data = await res.json();
  const json = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  const invoices = Array.isArray(json) ? json : (json.invoices || []);
  return { invoices, sha: data.sha };
}

// ── Helper: write invoices back to GitHub ──
async function saveToGitHub(invoices, sha) {
  const content = Buffer.from(JSON.stringify(invoices, null, 2)).toString('base64');
  const body    = { message: 'Update invoices via NRW Invoice App', content };
  if (sha) body.sha = sha;

  const res = await fetch(GH_API, {
    method:  'PUT',
    headers: GH_HEADERS,
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub save failed: ${res.status}`);
  const data = await res.json();
  return data.content.sha;   // return new sha
}

// ══════════════════════════════════════════
// GET /api/invoices
// Load all invoices from GitHub
// ══════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { invoices, sha } = await fetchFromGitHub();
    res.json({ success: true, invoices, sha });
  } catch (err) {
    console.error('[GET /api/invoices]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/invoices
// Add a new invoice
// Body: { invoice: {...}, sha: "..." }
// ══════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    let { invoice, sha } = req.body;

    // If no sha provided, fetch current state first
    let invoices;
    if (!sha) {
      ({ invoices, sha } = await fetchFromGitHub());
    } else {
      ({ invoices } = await fetchFromGitHub());
    }

    invoices.unshift(invoice);   // newest first
    const newSha = await saveToGitHub(invoices, sha);
    res.json({ success: true, sha: newSha, invoice });
  } catch (err) {
    console.error('[POST /api/invoices]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════
// PUT /api/invoices/:id
// Update an existing invoice
// Body: { invoice: {...}, sha: "..." }
// ══════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { invoice } = req.body;

    const { invoices, sha } = await fetchFromGitHub();
    const idx = invoices.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Invoice not found' });

    invoices[idx] = invoice;
    const newSha = await saveToGitHub(invoices, sha);
    res.json({ success: true, sha: newSha, invoice });
  } catch (err) {
    console.error('[PUT /api/invoices/:id]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════
// DELETE /api/invoices/:id
// Remove an invoice
// ══════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { invoices, sha } = await fetchFromGitHub();
    const filtered = invoices.filter(i => i.id !== id);
    if (filtered.length === invoices.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    const newSha = await saveToGitHub(filtered, sha);
    res.json({ success: true, sha: newSha });
  } catch (err) {
    console.error('[DELETE /api/invoices/:id]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
