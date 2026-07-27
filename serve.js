/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Provides a dependency-free local HTTP server for Editra development and demos.
 * Licensing: MIT License (open source)
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.EDITRA_PORT) || 8080;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const server = http.createServer((request, response) => {
  const isHttps = Boolean(request.socket?.encrypted);
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    const headers = {
      "Content-Type":
        mimeTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
      "Cache-Control": "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; media-src 'self' blob: https:; frame-src https:; connect-src 'self' https: wss:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'; trusted-types default dompurify editra-loader; require-trusted-types-for 'script'",
    };
    if (isHttps) {
      headers["Strict-Transport-Security"] =
        "max-age=31536000; includeSubDomains";
    }

    response.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(response);
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Editra is running at http://localhost:${port}`);
});
