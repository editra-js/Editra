"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const targetDirectory = path.join(root, "vendor");
const assets = [
  {
    source: path.join(
      root,
      "node_modules",
      "dompurify",
      "dist",
      "purify.min.js",
    ),
    target: "purify.min.js",
    name: "DOMPurify 3.4.13",
    purpose:
      "Vendors the pinned DOMPurify browser sanitizer used by the secure runtime.",
    license: "Apache-2.0 OR MPL-2.0",
  },
  {
    source: path.join(root, "node_modules", "jsbarcode", "dist", "JsBarcode.all.min.js"),
    target: "jsbarcode.min.js",
    name: "JsBarcode 3.11.6",
    purpose: "Vendors the barcode encoder used for Code 128, Code 39, and EAN-13 SVG output.",
    license: "MIT",
  },
  {
    source: path.join(root, "node_modules", "qrcode-generator", "dist", "qrcode.js"),
    target: "qrcode.js",
    name: "qrcode-generator 2.0.4",
    purpose: "Vendors the pure JavaScript QR matrix encoder.",
    license: "MIT",
  },
  {
    source: path.join(root, "node_modules", "qrcode-generator", "dist", "qrcode_UTF8.js"),
    target: "qrcode_UTF8.js",
    name: "qrcode-generator UTF-8 support 2.0.4",
    purpose: "Vendors UTF-8 byte encoding support for QR data.",
    license: "MIT",
  },
  {
    source: path.join(root, "node_modules", "@fontsource", "libre-barcode-128", "files", "libre-barcode-128-latin-400-normal.woff2"),
    target: path.join("assets", "fonts", "editra-code128.woff2"),
    name: "Libre Barcode 128 5.3.0",
    raw: true,
  },
  {
    source: path.join(root, "node_modules", "@fontsource", "libre-barcode-39", "files", "libre-barcode-39-latin-400-normal.woff2"),
    target: path.join("assets", "fonts", "editra-code39.woff2"),
    name: "Libre Barcode 39 5.3.0",
    raw: true,
  },
  {
    source: path.join(root, "node_modules", "@fontsource", "libre-barcode-ean13-text", "files", "libre-barcode-ean13-text-latin-400-normal.woff2"),
    target: path.join("assets", "fonts", "editra-ean13.woff2"),
    name: "Libre Barcode EAN13 Text 5.3.0",
    raw: true,
  },
  {
    source: path.join(root, "node_modules", "@fontsource", "libre-barcode-128", "LICENSE"),
    target: path.join("assets", "fonts", "OFL-1.1.txt"),
    name: "Libre Barcode OFL-1.1 license",
    raw: true,
  },
];

fs.mkdirSync(targetDirectory, { recursive: true });
assets.forEach((asset) => {
  if (!fs.existsSync(asset.source)) {
    throw new Error(`Pinned ${asset.name} runtime is missing. Run npm ci.`);
  }
  const target = asset.raw
    ? path.join(root, asset.target)
    : path.join(targetDirectory, asset.target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (asset.raw) fs.copyFileSync(asset.source, target);
  else {
    fs.copyFileSync(asset.source, target);
  }
});
console.log(`Synchronized ${assets.map((asset) => asset.name).join(" and ")}.`);
