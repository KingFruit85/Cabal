import { minuteInMs } from "../config/Constants.ts";
import { Cabal, CabalEvent, ICabalManager } from "../types/Room.ts";
import { MessageManager } from "./MessageManager.ts";

export class CabalManager implements ICabalManager {
  private cabals = new Map<string, Cabal>();
  private readonly DEFAULT_TTL = minuteInMs; // 1 minute for testing
  private expirationTimer?: number;
  private messageManager: MessageManager;
  private isInitialized = false;

  constructor(
    private readonly onCabalEvent: (event: CabalEvent) => void,
    messageManager: MessageManager
  ) {
    this.messageManager = messageManager;
    this.initialize().catch(console.error);
  }

  private async initialize(): Promise<void> {
    // Wait for messageManager to initialize
    await this.messageManager.waitForInitialization();
    this.isInitialized = true;

    // Start expiration check only after initialization
    this.expirationTimer = setInterval(() => {
      this.checkExpiredCabals().catch(console.error);
    }, 10000);
  }

  public async createCabal(name: string): Promise<Cabal | null> {
    console.log(`Creating cabal: ${name}`);
    if (this.cabals.has(name)) {
      return null;
    }

    const cabal: Cabal = {
      name,
      members: new Set(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ttl: this.DEFAULT_TTL,
    };

    this.cabals.set(name, cabal);

    this.onCabalEvent({
      type: "created",
      cabalName: name,
    });

    return cabal;
  }

  public async joinCabal(
    username: string,
    cabalName: string
  ): Promise<boolean> {
    const cabal = this.cabals.get(cabalName);
    if (!cabal) {
      return false;
    }

    cabal.members.add(username);
    this.refreshCabalTTL(cabalName);

    this.onCabalEvent({
      type: "joined",
      cabalName,
      username,
    });

    return true;
  }

  public async leaveCabal(username: string, cabalName: string): Promise<void> {
    const cabal = this.cabals.get(cabalName);
    if (!cabal) {
      return;
    }

    cabal.members.delete(username);

    this.onCabalEvent({
      type: "left",
      cabalName,
      username,
    });

    // If no members left, start TTL countdown
    if (cabal.members.size === 0) {
      this.refreshCabalTTL(cabalName);
    }
  }

  public async refreshCabalTTL(cabalName: string): Promise<void> {
    const cabal = this.cabals.get(cabalName);
    if (cabal) {
      cabal.lastActivity = Date.now();
    }
  }

  public getCabal(cabalName: string): Cabal | undefined {
    return this.cabals.get(cabalName);
  }

  public getAllCabals(): Map<string, Cabal> {
    return this.cabals;
  }

  private async checkExpiredCabals(): Promise<void> {
    if (!this.isInitialized || !this.messageManager.isInitialized()) {
      console.log("Skipping expiration check - not initialized");
      return;
    }

    const now = Date.now();

    for (const [name, cabal] of this.cabals.entries()) {
      const timeSinceLastActivity = now - cabal.lastActivity;

      if (timeSinceLastActivity >= cabal.ttl) {
        try {
          // Then try to delete messages
          await this.messageManager.deleteRoomMessages(name);

          // Remove from cabals first
          console.log(`Room ${name} has expired, sending event...`);
          this.cabals.delete(name);

          this.onCabalEvent({
            type: "expired",
            cabalName: name,
          });

          console.log(`Cabal expired: ${name}`);
        } catch (error) {
          console.error(`Error handling expiration for cabal ${name}:`, error);
        }
      }
    }
  }

  public getCabalMembers(cabalName: string): Set<string> | null {
    const cabal = this.cabals.get(cabalName);
    return cabal ? cabal.members : null;
  }

  public isMember(username: string, cabalName: string): boolean {
    const cabal = this.cabals.get(cabalName);
    return cabal ? cabal.members.has(username) : false;
  }

  public dispose(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
    }
  }
}
