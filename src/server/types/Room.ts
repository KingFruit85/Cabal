export interface Cabal {
  name: string;
  members: Set<string>;
  createdAt: number;
  lastActivity: number;
  ttl: number;
}

export interface ICabalManager {
  createCabal(name: string, description?: string): Promise<Cabal | null>;
  joinCabal(username: string, cabalName: string): Promise<boolean>;
  leaveCabal(username: string, cabalName: string): Promise<void>;
  refreshCabalTTL(cabalName: string): Promise<void>;
  getCabal(cabalName: string): Cabal | undefined;
  getAllCabals(): Map<string, Cabal>;
}

export type CabalEvent = {
  type: "created" | "joined" | "left" | "expired";
  cabalName: string;
  username?: string;
};
