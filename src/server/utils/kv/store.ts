import { GitHubUser } from "../../types/GitHubUser.ts";

export class KvTools {
  private kv!: Deno.Kv;

  private constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  public static async create(): Promise<KvTools> {
    const kv = await Deno.openKv();
    return new KvTools(kv);
  }

  public async storeUser(sessionId: string, userData: GitHubUser) {
    try {
      const key = ["sessions", sessionId];
      const res = await this.kv.set(key, userData);
      return res;
    } catch (error) {
      console.error("Error storing user:", error);
      throw error;
    }
  }

  public async getUser(sessionId: string): Promise<GitHubUser | null> {
    const key = ["sessions", sessionId];
    const res = await this.kv.get<GitHubUser>(key);
    return res.value;
  }
}
