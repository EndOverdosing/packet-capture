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

### Capturing plain HTTP traffic

No setup needed. Just point a client at the proxy:

```bash
curl -x http://127.0.0.1:8080 http://example.com
```

### Capturing HTTPS traffic (browser)

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

3. Launch a browser pointed at the proxy. A throwaway profile is recommended so your normal browsing isn't affected:

   ```bash
   # Windows
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --proxy-server="127.0.0.1:8080" --user-data-dir="C:\temp\chrome-proxy-profile"

   # macOS / Linux
   google-chrome --proxy-server="127.0.0.1:8080" --user-data-dir=/tmp/chrome-proxy-profile
   ```

4. Browse normally in that window. View the live results at `http://localhost:3000` in your regular browser (not the proxied one, to avoid the dashboard capturing its own traffic).

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

## Security notes

- The `.http-mitm-proxy/` folder contains a **private CA key** generated on your machine. It is used to sign fake certificates for every HTTPS site you visit through the proxy, which is what makes interception possible. Never commit or share this folder — anyone with it could impersonate HTTPS sites to any device that trusts your CA.
- Captured traffic in `captures/` may include cookies, authorization headers, and full request/response bodies. Treat this data as sensitive and do not commit it or share it carelessly.
- This tool is intended for local development and debugging on traffic you own or have permission to inspect. Do not use it to intercept traffic on networks or devices without authorization.

## License

See [LICENSE](LICENSE).