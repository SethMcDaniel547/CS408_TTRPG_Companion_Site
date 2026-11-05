"use strict";

const fs = require("node:fs");
const path = require("node:path");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// Serves the single-page frontend. Known app routes fall back to index.html so
// client-side routing works on direct navigation; everything else maps to a
// file under the frontend directory (with traversal protection).
function createStaticHandler(frontendDirectory) {
  const appRoutes = new Set([
    "/",
    "/signin",
    "/signup",
    "/account",
    "/character",
    "/room",
    "/room-settings",
    "/notes",
  ]);

  return function serveStatic(req, res) {
    const relativePath = appRoutes.has(req.path) ? "/index.html" : req.path;
    const filePath = path.resolve(frontendDirectory, `.${relativePath}`);

    if (!filePath.startsWith(`${frontendDirectory}${path.sep}`)) {
      res.status(404).type("text/plain").send("Not found\n");
      return;
    }

    fs.readFile(filePath, (error, file) => {
      if (error) {
        res.status(404).type("text/plain").send("Not found\n");
        return;
      }
      res
        .status(200)
        .type(contentTypes[path.extname(filePath)] || "application/octet-stream")
        .send(file);
    });
  };
}

module.exports = { createStaticHandler };
