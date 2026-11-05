"use strict";

const fs = require("node:fs");
const path = require("node:path");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Serves the built single-page frontend (Vite output). A request is treated as
// a static asset when a matching file exists under the build directory;
// anything else (the app's client-side routes such as /account or /room) falls
// back to index.html so React Router can handle it on direct navigation and
// refresh. Path traversal is still guarded.
//
// `frontendDirectory` should point at the Vite build output (frontend/dist).
function createStaticHandler(frontendDirectory) {
  const indexPath = path.join(frontendDirectory, "index.html");

  function sendFile(res, filePath) {
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
  }

  return function serveStatic(req, res) {
    // Resolve the requested path within the build directory, guarding traversal.
    const requested = req.path === "/" ? "/index.html" : req.path;
    const filePath = path.resolve(frontendDirectory, `.${requested}`);

    if (
      filePath !== frontendDirectory &&
      !filePath.startsWith(`${frontendDirectory}${path.sep}`)
    ) {
      res.status(404).type("text/plain").send("Not found\n");
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (!error && stats.isFile()) {
        sendFile(res, filePath);
        return;
      }
      // SPA fallback: unknown non-file route -> index.html for client routing.
      sendFile(res, indexPath);
    });
  };
}

module.exports = { createStaticHandler };
