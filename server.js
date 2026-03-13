/* ═══════════════════════════════════════
   NAVEEN REWINDING WORKS — server.js
   Express backend – keeps GitHub token
   safely on the server side.
═══════════════════════════════════════ */
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const invoiceRoutes = require('./routes/invoices');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────
app.use(cors());
app.use(express.json());

// Serve the frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ──────────────────────────
app.use('/api/invoices', invoiceRoutes);

// ── Catch-all: serve index.html for any unknown route ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────
app.listen(PORT, () => {
  console.log(`⚡ Naveen Invoice server running at http://localhost:${PORT}`);
});
