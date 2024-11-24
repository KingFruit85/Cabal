export type Cabal = {
  name: string;
  description?: string;
  members: Map<string, Date>;
  ttl: number;
  createdAt: number;
};

export type Gang = {
  name: string;
  description?: string;
  members: Map<string, Date>;
  createdAt: number;
};
