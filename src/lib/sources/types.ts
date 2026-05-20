export type RawLaunch = {
  externalId: string;
  name: string;
  tagline?: string;
  url: string;
  launchedAt: Date;
  votesCount?: number;
  topics?: string[];
  raw: unknown;
};

export interface LaunchSource {
  kind: "PRODUCT_HUNT" | "PEERPUSH" | "PEERLIST" | "UNEED" | "FOUNDRLIST" | "SCROLLLAUNCH";
  fetchSince(date: Date): Promise<RawLaunch[]>;
}
