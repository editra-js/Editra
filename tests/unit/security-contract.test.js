// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
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
assert.equal(packageMetadata.dependencies["qrcode-generator"], "2.0.4");
assert.equal(packageMetadata.dependencies.jsbarcode, "3.11.6");
assert.equal(packageMetadata.devDependencies["@fontsource/libre-barcode-128"], "5.3.0");
assert.equal(packageMetadata.devDependencies["@fontsource/libre-barcode-39"], "5.3.0");
assert.equal(
  packageMetadata.devDependencies["@fontsource/libre-barcode-ean13-text"],
  "5.3.0",
);
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

for (const removedAsset of ["plugins/rendering.js", "vendor/qrcode.min.js"]) {
  assert.ok(
    !fs.existsSync(path.join(root, removedAsset)),
    `Removed QR/barcode asset still exists: ${removedAsset}`,
  );
}

for (const asset of [
  "vendor/jsbarcode.min.js",
  "vendor/qrcode.js",
  "vendor/qrcode_UTF8.js",
  "assets/fonts/editra-code128.woff2",
  "assets/fonts/editra-code39.woff2",
  "assets/fonts/editra-ean13.woff2",
  "assets/fonts/OFL-1.1.txt",
]) {
  assert.ok(
    fs.existsSync(path.join(root, asset)),
    `Missing embedded code resource: ${asset}`,
  );
}

for (const asset of ["assets/icons/qr-code.svg", "assets/icons/barcode.svg"]) {
  assert.ok(
    fs.existsSync(path.join(root, asset)),
    `Missing QR/barcode asset: ${asset}`,
  );
}

assert.ok(read("plugins/codes.js").includes("global.JsBarcode"));
assert.ok(read("plugins/codes.js").includes("global.qrcode"));

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
