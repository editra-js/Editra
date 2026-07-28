// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Covers barcode and QR code resource and persistence contracts.
 * Licensing: MIT License (open source)
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "plugins/codes.js"), "utf8");

test("codes plugin uses validated standard encoders and persistent SVG markup", () => {
  assert.match(source, /CODE128/);
  assert.match(source, /CODE39/);
  assert.match(source, /EAN13/);
  assert.match(source, /ean13CheckDigit/);
  assert.match(source, /global\.JsBarcode/);
  assert.match(source, /global\.qrcode/);
  assert.match(source, /data-editra|dataset\.editraBarcode|dataset\.editraQr/);
  assert.doesNotMatch(source, /document\.createElement\("canvas"\)/);
});
