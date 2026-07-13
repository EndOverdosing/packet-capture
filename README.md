# Packet Capture

A lightweight local HTTP/HTTPS traffic inspector. It runs a man-in-the-middle proxy on your machine and streams every request and response to a live web dashboard — useful for debugging API calls, inspecting what an app or browser is sending, or just learning how HTTP traffic actually looks on the wire.

![Node](https://img.shields.io/badge/node-%3E%3D18-green)

## How it works

```
Browser / App  →  Proxy (127.0.0.1:8080)  →  Internet
                        │
                        ▼
              Dashboard (localhost:3000)
```

The proxy sits between your client and the internet. Every request and its matching response are captured, written to disk as JSON, and pushed live to the dashboard over a WebSocket.

**Nothing shows up in the dashboard until something is actually configured to send its traffic through the proxy.** Opening the dashboard itself does not capture anything — the dashboard only displays what passes through port `8080`. See [Routing traffic through the proxy](#routing-traffic-through-the-proxy) below.

## Features

- Live-updating dashboard — no refresh needed
- Captures full request/response headers, status codes, and timing
- HTTPS interception via an auto-generated local CA certificate
- Every capture also saved to disk as JSON for offline inspection
- Zero configuration to get started with plain HTTP

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- npm

## Installation

```bash
git clone https://github.com/endoverdosing/packet-capture.git
cd packet-capture
npm install
```

## Usage

```bash
npm start
```

This starts:
- The proxy on `127.0.0.1:8080`
- The dashboard on [http://localhost:3000](http://localhost:3000)

Open the dashboard in a browser, then point traffic at the proxy (see below). Requests will start appearing in the table as they happen.

## Routing traffic through the proxy

The proxy does nothing on its own — it only sees traffic that is explicitly sent to `127.0.0.1:8080`. Pick one of the options below depending on what you want to capture.

### Quick sanity check (do this first)

Before configuring a browser, confirm the proxy and dashboard are working end-to-end with a single request:

```bash
curl -x http://127.0.0.1:8080 http://example.com
```

Watch `http://localhost:3000` — this request should appear immediately. If it doesn't, the proxy/dashboard setup itself has a problem and browser configuration won't help until that's fixed. If it does appear, the pipeline is healthy and any remaining issue is just about getting your browser to actually use the proxy.

### Option 1 — Launch a browser with a proxy flag (recommended)

This routes only that one browser window through the proxy, in a throwaway profile that doesn't touch your normal browsing, bookmarks, or logins.

**Chrome — Windows:**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --proxy-server="127.0.0.1:8080" --user-data-dir="C:\temp\chrome-proxy-profile"
```

**Chrome — macOS/Linux:**
```bash
google-chrome --proxy-server="127.0.0.1:8080" --user-data-dir=/tmp/chrome-proxy-profile
```

**Edge — Windows:**
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --proxy-server="127.0.0.1:8080" --user-data-dir="C:\temp\edge-proxy-profile"
```

A new window opens using a fresh, empty profile. Browse there — traffic from that window will stream into the dashboard. View the dashboard itself in your **regular** browser window, not the proxied one, so the dashboard doesn't end up capturing its own traffic.

Start with a plain HTTP site to confirm it's working before trying HTTPS:
```
http://neverssl.com
```

### Option 2 — System-wide proxy (Windows)

This routes traffic from Edge, most other apps, and anything else that respects the OS proxy setting — not just one browser window.

1. Open **Settings → Network & Internet → Proxy**
2. Under **Manual proxy setup**, turn on **Use a proxy server**
3. Set Address to `127.0.0.1` and Port to `8080`
4. Save, then browse normally

**Remember to turn this off when you're done** — while it's on, all your traffic (not just test browsing) is routed through the local proxy, and any app that ignores the OS proxy setting or expects a direct connection may misbehave.

macOS equivalent: **System Settings → Network → \<your connection\> → Details → Proxies → Web Proxy (HTTP) / Secure Web Proxy (HTTPS)**, set to `127.0.0.1:8080`.

### HTTPS sites will show certificate warnings until you trust the CA

Whichever option you use, HTTPS sites will fail with a certificate warning (or fail silently) until the proxy's certificate is trusted — see the next section.

## Capturing HTTPS traffic

HTTPS interception requires trusting the proxy's locally-generated CA certificate. This certificate is unique to your machine and is regenerated fresh on first run — it is never shared or committed anywhere.

1. Start the server once with `npm start`. This generates `.http-mitm-proxy/certs/ca.pem` in the project folder.
2. Trust the certificate:

   **Windows** (run PowerShell as Administrator):
   ```powershell
   certutil -addstore -f "ROOT" ".\.http-mitm-proxy\certs\ca.pem"
   ```

   **macOS**:
   ```bash
   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./.http-mitm-proxy/certs/ca.pem
   ```

   **Linux** (Debian/Ubuntu):
   ```bash
   sudo cp ./.http-mitm-proxy/certs/ca.pem /usr/local/share/ca-certificates/packet-capture-ca.crt
   sudo update-ca-certificates
   ```

3. Restart the browser profile you're using to proxy traffic (close and relaunch with the same `--user-data-dir`, or just restart the browser if using the system-wide proxy option) so it picks up the newly trusted certificate.
4. Browse to an HTTPS site. It should load normally with no warning, and the request will appear in the dashboard with the full URL, headers, and status code.

If you still see a certificate warning after this, double check you trusted the cert for the correct profile — a browser profile that was already open when you ran `certutil`/`security` may need a full restart to pick up the change.

## Configuration

Set these environment variables to change the defaults:

| Variable         | Default     | Description                       |
|-------------------|-------------|------------------------------------|
| `PROXY_PORT`      | `8080`      | Port the MITM proxy listens on     |
| `PROXY_HOST`      | `127.0.0.1` | Interface the proxy binds to       |
| `DASHBOARD_PORT`  | `3000`      | Port the dashboard/WebSocket server listens on |

Example:

```bash
PROXY_PORT=8888 DASHBOARD_PORT=4000 npm start
```

## Project structure

```
packet-capture/
├── server.js          # Proxy + dashboard server
├── public/
│   └── index.html      # Dashboard UI
├── captures/            # Captured traffic, saved as JSON (gitignored)
└── .http-mitm-proxy/    # Auto-generated CA cert/key (gitignored, never commit)
```

## Troubleshooting

**Dashboard shows nothing, even after browsing:**
Confirm the browser window you're using is actually the proxied one (check the window title bar or that you launched it with the `--proxy-server` flag / confirmed the system proxy is on). A normal, unconfigured browser window will never appear in the dashboard no matter how much you browse in it.

**`curl -x http://127.0.0.1:8080 ...` works but the browser doesn't:**
This means the proxy and dashboard are healthy — the issue is purely that the browser isn't routing through the proxy. Revisit [Routing traffic through the proxy](#routing-traffic-through-the-proxy).

**HTTPS sites fail or show certificate warnings:**
The proxy's CA certificate hasn't been trusted yet, or the browser was open before you trusted it. See [Capturing HTTPS traffic](#capturing-https-traffic).

**`EADDRINUSE` or "port already in use" on startup:**
Something else is already using port `8080` or `3000`. Either stop that process or change the port with `PROXY_PORT` / `DASHBOARD_PORT` (see [Configuration](#configuration)).

## Security notes

- The `.http-mitm-proxy/` folder contains a **private CA key** generated on your machine. It is used to sign fake certificates for every HTTPS site you visit through the proxy, which is what makes interception possible. Never commit or share this folder — anyone with it could impersonate HTTPS sites to any device that trusts your CA.
- Captured traffic in `captures/` may include cookies, authorization headers, and full request/response bodies. Treat this data as sensitive and do not commit it or share it carelessly.
- This tool is intended for local development and debugging on traffic you own or have permission to inspect. Do not use it to intercept traffic on networks or devices without authorization.

## License

See [LICENSE](LICENSE).