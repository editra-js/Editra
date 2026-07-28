"use strict";

const path = require("node:path");

module.exports = {
  mode: "production",
  target: ["web", "es2018"],
  devtool: false,
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "editra.js",
    library: "Editra",
    libraryTarget: "umd",
    globalObject: "typeof self !== 'undefined' ? self : this",
    clean: false,
  },
  optimization: {
    minimize: true,
  },
};
