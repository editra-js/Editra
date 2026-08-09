"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const copyDirectory = (source, target) => {
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
};

fs.mkdirSync(dist, { recursive: true });
const coreSource = fs
  .readFileSync(path.join(root, "core", "editor.js"), "utf8")
  .replace(
    'const projectBase = new URL("../", bootstrapScript.src);',
    'const projectBase = new URL("./", bootstrapScript.src);',
  );
if (!coreSource.includes('const projectBase = new URL("./", bootstrapScript.src);')) {
  throw new Error("Unable to configure the modular Editra distribution root.");
}
fs.writeFileSync(path.join(dist, "editra-core.js"), coreSource);
fs.writeFileSync(
  path.join(dist, "editra-core.css"),
  '/* Editra modular core styles. Theme selection remains runtime-configurable. */\n@import url("../themes/word.css");\n',
);
copyDirectory(path.join(root, "plugins"), path.join(dist, "plugins"));
copyDirectory(path.join(root, "ui"), path.join(dist, "ui"));
copyDirectory(path.join(root, "vendor"), path.join(dist, "vendor"));
copyDirectory(path.join(root, "assets"), path.join(dist, "assets"));
fs.mkdirSync(path.join(dist, "core"), { recursive: true });
fs.copyFileSync(
  path.join(root, "core", "security.js"),
  path.join(dist, "core", "security.js"),
);
fs.copyFileSync(
  path.join(root, "core", "document-schema.js"),
  path.join(dist, "core", "document-schema.js"),
);
console.log("Built modular Editra core, plugin, UI, security, schema, and asset distribution.");
