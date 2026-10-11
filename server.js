const http = require("node:http");

const port = Number.parseInt(process.env.PORT || "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const landingPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TTRPG Companion</title>
    <style>
      body { background: #171321; color: #f4e9d8; font: 1.1rem/1.6 system-ui, sans-serif; margin: 0; }
      main { margin: 15vh auto; max-width: 42rem; padding: 2rem; text-align: center; }
      h1 { color: #f0b35b; font-size: clamp(2.5rem, 8vw, 5rem); margin: 0; }
      p { color: #d8cce4; }
    </style>
  </head>
  <body>
    <main>
      <h1>Hello, adventurer!</h1>
      <p>Your TTRPG Companion is online and ready for the next campaign.</p>
    </main>
  </body>
</html>`;

const server = http.createServer((request, response) => {
  if (request.url === "/api/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(landingPage);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found\n");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TTRPG Companion listening on http://127.0.0.1:${port}/`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
