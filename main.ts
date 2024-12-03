import { Application, Context, Router } from "@oak/oak";
import { parseArgs } from "jsr:@std/cli/parse-args";
import ChatServer from "./src/server/ChatServer.ts";

const app = new Application();
const portArg = parseArgs(Deno.args, {
  string: ["port"],
});

const PortToParse = portArg.port || "8080";
const port = parseInt(PortToParse);
const router = new Router();
const server = new ChatServer();
let abortController = new AbortController();

// Add MIME type mapping
const MIME_TYPES: Record<string, string> = {
  ".ts": "application/javascript",
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
};

app.use(async (context, next) => {
  try {
    const path = context.request.url.pathname;
    // Set TypeScript files to be served as JavaScript modules
    if (path.endsWith(".ts")) {
      context.response.headers.set("Content-Type", "application/javascript");
    }
    await context.send({
      root: Deno.cwd(),
      index: "public/index.html",
    });
  } catch {
    await next();
  }
});

// WebSocket route
router.get("/start_web_socket", (ctx: Context) => server.handleConnection(ctx));

app.use(router.routes());
app.use(router.allowedMethods());

// Handle shutdown signals
async function shutdown() {
  console.info("Shutting down server...");
  abortController.abort();
  await new Promise((resolve) => setTimeout(resolve, 100));
  Deno.exit(0);
}

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

console.info("Listening at http://localhost:" + port);
await app.listen({ port });
