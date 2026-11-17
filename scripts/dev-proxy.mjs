#!/usr/bin/env node
// Temporary local proxy; no dependencies. Run from any directory with Node.js.
// Browser: http://localhost:9000/play
// Backend: BETTER_AUTH_URL=http://localhost:9000 (restart after changing it).
// Optional environment variables: PROXY_PORT=9000 WEB_PORT=3000 GAME_PORT=8080.
import http from "node:http";

function port(name, fallback) {
    const value = Number(process.env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error(`${name} must be a port between 1 and 65535`);
    }
    return value;
}

const proxyPort = port("PROXY_PORT", 9000);
const webPort = port("WEB_PORT", 3000);
const gamePort = port("GAME_PORT", 8080);
if ([webPort, gamePort].includes(proxyPort)) {
    throw new Error("PROXY_PORT must differ from the upstream ports");
}

function options(req, upgrade = false) {
    const game = upgrade && req.url?.split("?")[0] === "/game-socket";
    return {
        hostname: "127.0.0.1",
        port: game ? gamePort : webPort,
        method: req.method,
        path: game ? "/" : req.url,
        // Preserve Host, Origin, cookies, and WebSocket negotiation headers.
        headers: {
            ...req.headers,
            "x-forwarded-host": req.headers.host,
            "x-forwarded-proto": "http",
            "x-forwarded-for": req.socket.remoteAddress,
        },
    };
}

const server = http.createServer((req, res) => {
    const upstream = http.request(options(req), (reply) => {
        res.writeHead(reply.statusCode || 502, reply.headers);
        reply.on("error", () => res.destroy());
        reply.pipe(res);
    });
    upstream.setTimeout(120_000, () => upstream.destroy());
    upstream.on("error", () => {
        if (res.headersSent) return res.destroy();
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Web upstream unavailable on 127.0.0.1:${webPort}\n`);
    });
    req.on("aborted", () => upstream.destroy());
    req.on("error", () => upstream.destroy());
    res.on("close", () => {
        if (!res.writableFinished) upstream.destroy();
    });
    req.pipe(upstream);
});

// Route game upgrades separately; pass Next.js hot-reload upgrades to the web app.
server.on("upgrade", (req, client, head) => {
    const upstream = http.request(options(req, true));
    upstream.setTimeout(120_000, () => upstream.destroy());
    client.on("error", () => upstream.destroy());
    client.on("close", () => upstream.destroy());
    upstream.on("error", () => {
        if (!client.destroyed) {
            client.end(
                "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
            );
        }
    });
    upstream.on("response", (reply) => {
        reply.resume();
        client.end(
            "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        );
    });
    upstream.on("upgrade", (reply, remote, remoteHead) => {
        remote.setTimeout(0);
        const headers = [];
        for (let i = 0; i < reply.rawHeaders.length; i += 2) {
            headers.push(`${reply.rawHeaders[i]}: ${reply.rawHeaders[i + 1]}`);
        }
        client.write(
            `HTTP/1.1 101 Switching Protocols\r\n${headers.join("\r\n")}\r\n\r\n`,
        );
        if (remoteHead.length) client.write(remoteHead);
        if (head.length) remote.write(head);
        remote.on("error", () => client.destroy());
        client.on("error", () => remote.destroy());
        remote.on("close", () => client.destroy());
        client.on("close", () => remote.destroy());
        client.pipe(remote).pipe(client);
    });
    upstream.end();
});

const clients = new Set();
server.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
});
server.on("error", (error) => {
    console.error(`Proxy failed: ${error.message}`);
    process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        server.close();
        for (const socket of clients) socket.destroy();
    });
}
server.listen(proxyPort, "127.0.0.1", () => {
    console.log(`Open http://localhost:${proxyPort}/play`);
    console.log(`HTTP + Next.js HMR → 127.0.0.1:${webPort}`);
    console.log(`/game-socket      → 127.0.0.1:${gamePort}`);
    console.log(`Set backend BETTER_AUTH_URL=http://localhost:${proxyPort}`);
    console.log("Ctrl+C to stop.");
});
