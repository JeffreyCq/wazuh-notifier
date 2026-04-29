# Wazuh Notifier

A browser extension that monitors one or more Wazuh SIEM clusters and delivers real-time desktop notifications when critical alerts are detected. Works with both self-hosted OpenSearch deployments and Wazuh Cloud.

> Supports **Chrome** (Manifest V3 service worker) and **Firefox** (Manifest V3 background scripts).

---

## Features

- **Multi-cluster** — add as many Wazuh clusters as you need, each with its own settings
- **Two connection modes** — self-hosted OpenSearch (basic auth) or Wazuh Cloud (session cookie proxy)
- **Configurable per cluster** — alert level threshold (1–15), poll interval, and optional agent name filter
- **Desktop notifications** — native browser notifications with alert description and agent name
- **Sound alerts** — optional Web Audio API beep when new critical alerts arrive
- **Popup dashboard** — filterable list of recent alerts, per-cluster status indicator, manual poll button
- **Export** — download alert history as JSON or CSV from the popup or settings page

---

## Installation

### Prerequisites

```
Node.js 18+
npm
```

### Build

```bash
# Clone the repo
git clone https://github.com/JeffreyCq/wazuh-notifier.git
cd wazuh-notifier

# Install dependencies
npm install

# Generate icons from your logo (requires public/icons/logo.png)
node scripts/generate-icons.js

# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox
```

Output lands in `dist/chrome/` and `dist/firefox/` respectively.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `dist/chrome/`

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** → select any file inside `dist/firefox/`

---

## Configuration

Click the extension icon → **Settings** (or right-click → *Extension options*).

### Adding a cluster

Click **+ Add Cluster** and fill in:

| Field | Description |
|---|---|
| **Cluster Name** | A friendly label shown in the popup |
| **Connection Mode** | *Self-hosted* or *Wazuh Cloud* (see below) |
| **OpenSearch URL** | Base URL of your OpenSearch node, e.g. `https://192.168.1.100:9200` |
| **Username / Password** | OpenSearch credentials (self-hosted only) |
| **Dashboard URL** | Your Wazuh Cloud dashboard URL, e.g. `https://xxxx.cloud.wazuh.com` |
| **Poll Interval** | How often to check for new alerts (1–60 minutes) |
| **Min Alert Level** | Minimum Wazuh rule level to notify on (default: 12) |
| **Agent Filter** | Optional partial match on `agent.name` to narrow results |

Use **Test Connection** before saving to verify credentials and reachability.

### Self-hosted (OpenSearch)

The extension queries `POST /wazuh-alerts-*/_search` directly against your OpenSearch node using HTTP Basic Auth. If your node uses a self-signed certificate you will need to visit the URL in the browser once and accept the certificate exception before the extension can connect.

### Wazuh Cloud

The extension sends requests to the Wazuh Dashboard internal search proxy (`/internal/search/opensearch-with-long-numerals`) using `credentials: 'include'`, so it inherits your active browser session. **Log into your Wazuh dashboard in the browser before using this mode.** No credentials are stored.

---

## Project Structure

```
src/
├── background/     # Service worker — polling loop, notifications, alarm scheduling
├── options/        # Settings page (cluster CRUD, sound toggle, data export)
├── popup/          # Popup UI (alert list, filters, per-cluster status)
├── types/          # Shared TypeScript interfaces
└── utils/
    ├── api.ts      # OpenSearch + Dashboard API calls
    ├── sound.ts    # Web Audio API notification beep
    └── storage.ts  # chrome.storage wrappers and config migration

scripts/
└── generate-icons.js   # Resizes public/icons/logo.png → icon16/48/128.png (sharp)

manifest.json           # Chrome (service_worker)
manifest.firefox.json   # Firefox (background.scripts)
webpack.config.js       # Dual-target build
```

---

## npm Scripts

| Command | Description |
|---|---|
| `npm run build` | Production build for Chrome → `dist/chrome/` |
| `npm run build:firefox` | Production build for Firefox → `dist/firefox/` |

---

## Permissions

| Permission | Reason |
|---|---|
| `notifications` | Show desktop alerts when critical events are detected |
| `storage` | Persist cluster config and alert history locally |
| `alarms` | Schedule periodic polling without keeping the page open |
| `host_permissions: <all_urls>` | Connect to arbitrary OpenSearch / Wazuh Cloud URLs configured by the user |

No data is sent to any third party. Everything stays between your browser and your Wazuh cluster.

---

## License

MIT
