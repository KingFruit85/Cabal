import { Application, Context, Router } from "@oak/oak";
import ChatServer from "./src/server/ChatServer.ts";
import { bgGreen } from "jsr:@std/internal@^1.0.5/styles";
import { createGitHubOAuthConfig, createHelpers } from "@deno/kv-oauth";
import { handleGithubCallback } from "./auth.ts";
import { KvTools } from "./src/server/utils/kv/store.ts";

const app = new Application();
const router = new Router();

const oauthConfig = createGitHubOAuthConfig();
const { signIn, signOut, getSessionId } = createHelpers(oauthConfig);

const server = new ChatServer();

app.use(router.routes());
app.use(router.allowedMethods());

app.use(async (context) => {
  await context.send({
    root: Deno.cwd(),
    index: "public/index.html",
  });
});

router.get("/signin", async (ctx) => {
  const request = new Request(ctx.request.url.toString(), {
    headers: ctx.request.headers,
    method: ctx.request.method,
  });
  const response = await signIn(request);
  ctx.response.body = response.body;
  ctx.response.headers = response.headers;
  ctx.response.status = response.status;
});

router.get("/oauth/callback", async (ctx) => {
  const request = new Request(ctx.request.url.toString(), {
    headers: ctx.request.headers,
    method: ctx.request.method,
  });

  const response = await handleGithubCallback(request);
  ctx.response.body = response.body;
  ctx.response.headers = response.headers;
  ctx.response.status = response.status;
  ctx.response.redirect("/");
});

router.get("/signout", async (ctx) => {
  const request = new Request(ctx.request.url.toString(), {
    headers: ctx.request.headers,
    method: ctx.request.method,
  });

  const response = await signOut(request);
  ctx.response.body = response.body;
  ctx.response.headers = response.headers;
  ctx.response.status = response.status;
});

router.get("/api/auth", async (ctx) => {
  const request = new Request(ctx.request.url.toString(), {
    headers: ctx.request.headers,
    method: ctx.request.method,
  });

  const sessionId = await getSessionId(request);
  if (!sessionId) {
    ctx.response.status = 401;
    ctx.response.body = "Not authenticated";
    return;
  }

  const kvTools = await KvTools.create();
  const userDetails = await kvTools.getUser(sessionId);

  ctx.response.status = 200;
  ctx.response.type = "application/json"; // Set content type to JSON
  ctx.response.body = JSON.stringify(userDetails);
});

router.get("/start_web_socket", async (ctx: Context) => {
  const request = new Request(ctx.request.url.toString(), {
    headers: ctx.request.headers,
    method: ctx.request.method,
  });

  const sessionId = await getSessionId(request);
  if (!sessionId) {
    ctx.response.status = 401;
    ctx.response.body = "Not authenticated";
    return;
  }

  const kvTools = await KvTools.create();
  const userDetails = await kvTools.getUser(sessionId);

  if (!userDetails) {
    ctx.response.status = 401;
    ctx.response.body = "No user details found";
    return;
  }

  await server.handleConnection(ctx, userDetails);
});

// Handle shutdown signals
const abortController = new AbortController();

async function shutdown() {
  console.info("Shutting down server...");
  abortController.abort();
  await new Promise((resolve) => setTimeout(resolve, 100));
  Deno.exit(0);
}

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

await app.listen({ port: 8080 });
console.log(bgGreen("Listening at http://localhost:8080"));
