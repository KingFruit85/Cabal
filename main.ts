import { Application, Context, Router } from "@oak/oak";
import { parseArgs } from "jsr:@std/cli/parse-args";
import ChatServer from "./ChatServer.ts";

const app = new Application();
const portArg = parseArgs(Deno.args, {
  string: ["port"],
});

const PortToParse = portArg.port || "8080";

const port = parseInt(PortToParse);
const router = new Router();
const server = new ChatServer();
let abortController = new AbortController();

router.get("/start_web_socket", (ctx: Context) => server.handleConnection(ctx));

app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context) => {
  await context.send({
    root: Deno.cwd(),
    index: "public/index.html",
  });
});

// Handle shutdown signals
async function shutdown() {
  console.info("Shutting down server...");
  abortController.abort();
  // Give time for connections to close
  await new Promise((resolve) => setTimeout(resolve, 100));
  Deno.exit(0);
}

Deno.addSignalListener("SIGINT", shutdown); // Ctrl+C
Deno.addSignalListener("SIGTERM", shutdown); // Kill command

console.info("Listening at http://localhost:" + port);
await app.listen({ port });
