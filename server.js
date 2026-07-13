const Proxy = require("http-mitm-proxy").Proxy;
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3000;
const PROXY_PORT = process.env.PROXY_PORT || 8080;
const PROXY_HOST = process.env.PROXY_HOST || "127.0.0.1";
const CAPTURE_DIR = path.join(__dirname, "captures");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(CAPTURE_DIR)) {
    fs.mkdirSync(CAPTURE_DIR);
}

const server = app.listen(DASHBOARD_PORT, () => {
    console.log(`Dashboard: http://localhost:${DASHBOARD_PORT}`);
});

const wss = new WebSocket.Server({ server });

function broadcast(data) {
    const payload = JSON.stringify(data);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

function writeCapture(startedAt, capture) {
    fs.writeFile(
        path.join(CAPTURE_DIR, `${startedAt}.json`),
        JSON.stringify(capture, null, 2),
        (err) => {
            if (err) console.error("Failed to write capture file:", err.message);
        }
    );
}

const proxy = new Proxy();

proxy.onRequest((ctx, callback) => {
    const req = ctx.clientToProxyRequest;

    // req.url is just a path for HTTPS traffic (post-CONNECT tunnel),
    // so rebuild the full URL from the Host header for anything not already absolute.
    const isTLS = !!ctx.isSSL;
    const host = req.headers.host || "";
    const fullUrl = req.url.startsWith("http")
        ? req.url
        : `${isTLS ? "https" : "http"}://${host}${req.url}`;

    const startedAt = Date.now();

    const capture = {
        time: new Date().toISOString(),
        method: req.method,
        url: fullUrl,
        requestHeaders: req.headers,
        status: null,
        statusMessage: null,
        responseHeaders: null,
        durationMs: null
    };

    console.log("REQUEST: ", req.method, fullUrl);

    ctx.onResponse((ctx2, callback2) => {
        const res = ctx2.serverToProxyResponse;

        capture.status = res.statusCode;
        capture.statusMessage = res.statusMessage;
        capture.responseHeaders = res.headers;
        capture.durationMs = Date.now() - startedAt;

        console.log("RESPONSE:", res.statusCode, fullUrl, `${capture.durationMs}ms`);

        writeCapture(startedAt, capture);
        broadcast(capture);

        callback2();
    });

    callback();
});

proxy.onError((ctx, err, errorKind) => {
    const url = ctx && ctx.clientToProxyRequest ? ctx.clientToProxyRequest.url : "";
    console.error(`PROXY ERROR [${errorKind}]`, url, "-", err.message);
});

proxy.listen({ port: PROXY_PORT, host: PROXY_HOST }, (err) => {
    if (err) {
        console.error("Proxy failed to start:", err);
        process.exit(1);
    }
    console.log(`Proxy running on ${PROXY_HOST}:${PROXY_PORT}`);
    console.log(`CA certificate: ${path.join(__dirname, ".http-mitm-proxy", "certs", "ca.pem")}`);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
});