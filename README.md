# ⚡ Naveen Rewinding Works — Invoice Manager

A Node.js + Express invoice management web app.  
Your GitHub token stays **securely on the server** — it is never sent to the browser.

---

## Project Structure

```
naveen-invoice/
├── server.js            ← Express entry point
├── package.json
├── .env                 ← Your secrets (never commit this)
├── .gitignore
├── routes/
│   └── invoices.js      ← REST API (GitHub calls happen here)
└── public/              ← Static frontend
    ├── index.html
    ├── style.css
    └── app.js           ← Browser JS (talks to /api/invoices)
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env`
Edit `.env` and fill in your real GitHub token:
```
PORT=3000
GITHUB_TOKEN=ghp_your_real_token_here
GH_OWNER=sankar-c-hub
GH_REPO=cr-fashions-data
GH_FILE=data/invoice.json
```

### 3. Run the server
```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

### 4. Open the app
Visit **http://localhost:3000** in your browser.

---

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET    | `/api/invoices`       | Load all invoices from GitHub |
| POST   | `/api/invoices`       | Add a new invoice |
| PUT    | `/api/invoices/:id`   | Update an existing invoice |
| DELETE | `/api/invoices/:id`   | Delete an invoice |

---

## Security Notes

- The `.env` file is in `.gitignore` — **never commit it**.
- The GitHub token is only used in `routes/invoices.js` on the server.
- The browser (`public/app.js`) only ever calls `/api/invoices` on your own server.
