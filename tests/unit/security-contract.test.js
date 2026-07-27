/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Enforces static enterprise security, supply-chain, and lifecycle contracts.
 * Licensing: MIT License (open source)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const security = read("core/security.js");
const core = read("core/editor.js");
const paste = read("plugins/paste.js");
const exportPlugin = read("plugins/export.js");
const toolbar = read("ui/toolbar.js");
const server = read("serve.js");
const packageMetadata = JSON.parse(read("package.json"));

for (const token of [
  "DOMPurify",
  "SANITIZE_NAMED_PROPS",
  "FORBID_TAGS",
  "maxDocumentBytes",
  "maxNodes",
  "maxDepth",
  "maxMediaBytes",
  "allowedPluginOrigins",
  "requirePluginIntegrity",
  "csrfToken",
  "editra:security-violation",
]) {
  assert.ok(security.includes(token), `Missing security control: ${token}`);
}

assert.ok(core.includes('loadScript("vendor/purify.min.js")'));
assert.ok(core.includes('loadScript("core/security.js")'));
assert.ok(core.includes("this.security.trustedHTML"));
assert.ok(core.includes("this.security?.destroy()"));
assert.ok(paste.includes("core.sanitizeHTML"));
assert.ok(exportPlugin.includes("core.sanitizeHTML"));
assert.ok(!exportPlugin.includes("frameDocument.write"));
assert.ok(toolbar.includes("../assets/icons/"));
assert.ok(toolbar.includes('document.createElement("img")'));
assert.ok(!toolbar.includes("svg.innerHTML"));
assert.ok(server.includes("font-src 'self'"));
assert.equal(packageMetadata.dependencies.dompurify, "3.4.12");
assert.ok(!packageMetadata.dependencies.qrcode);
assert.ok(!packageMetadata.dependencies.jsbarcode);
assert.equal(packageMetadata.devDependencies.webpack, "5.109.0");
assert.equal(packageMetadata.devDependencies["webpack-cli"], "6.0.1");

for (const icon of [
  "bold.svg",
  "italic.svg",
  "underline.svg",
  "table.svg",
  "image.svg",
  "video.svg",
  "undo.svg",
  "redo.svg",
]) {
  assert.ok(
    fs.existsSync(path.join(root, "assets", "icons", icon)),
    `Missing toolbar icon asset: ${icon}`,
  );
}

for (const removedAsset of [
  "plugins/rendering.js",
  "assets/icons/qr-code.svg",
  "assets/icons/barcode.svg",
  "vendor/qrcode.min.js",
  "vendor/jsbarcode.min.js",
]) {
  assert.ok(
    !fs.existsSync(path.join(root, removedAsset)),
    `Removed QR/barcode asset still exists: ${removedAsset}`,
  );
}

for (const [file, source] of Object.entries({
  "core/editor.js": core,
  "plugins/export.js": exportPlugin,
  "ui/toolbar.js": toolbar,
  "ui/menubar.js": read("ui/menubar.js"),
  "themes/premium.css": read("themes/premium.css"),
})) {
  assert.ok(
    !/renderQRCode|renderBarcode|renderModesForExport|applyRenderMode|render-mode|data-render/i.test(
      source,
    ),
    `${file} still contains QR/barcode behavior`,
  );
}

const executableFiles = [
  "core/editor.js",
  "core/security.js",
  ...fs
    .readdirSync(path.join(root, "plugins"))
    .filter((file) => file.endsWith(".js"))
    .map((file) => `plugins/${file}`),
];
for (const file of executableFiles) {
  const source = read(file);
  assert.ok(!/\beval\s*\(/.test(source), `${file} uses eval`);
  assert.ok(!/\bnew\s+Function\s*\(/.test(source), `${file} uses new Function`);
  assert.ok(!/document\.write\s*\(/.test(source), `${file} uses document.write`);
}

console.log("Enterprise security contract passed.");
