import { createGitHubOAuthConfig, createHelpers } from "jsr:@deno/kv-oauth";
import { GitHubUser } from "./src/server/types/GitHubUser.ts";
import { KvTools } from "./src/server/utils/kv/store.ts";
import { pick } from "jsr:@std/collections/pick";
import { Context } from "@oak/oak/context";

const oauthConfig = createGitHubOAuthConfig();

const { handleCallback, getSessionId } = createHelpers(oauthConfig);

export async function getCurrentUser(request: Request): Promise<Response> {
  const sessionId = await getSessionId(request);
  if (!sessionId) {
    return new Response("Not authenticated", { status: 401 });
  }

  return new Response("Authenticated", { status: 200 });
}

export async function getGitHubProfile(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    response.body?.cancel();
    throw new Error("Failed to get GitHub profile");
  }

  return response.json() as Promise<GitHubUser>;
}

export async function handleGithubCallback(request: Request) {
  const { response, tokens, sessionId } = await handleCallback(request);
  const userData = await getGitHubProfile(tokens?.accessToken);
  const filteredData = pick(userData, ["login", "avatar_url", "html_url"]);
  const kvTools = await KvTools.create();
  await kvTools.storeUser(sessionId, filteredData);
  return response;
}
