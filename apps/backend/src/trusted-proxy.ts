type TrustProxyTarget = {
  set(setting: "trust proxy", value: number): unknown;
};

export function configureTrustProxy(target: TrustProxyTarget, hops: number): void {
  if (hops === 0) {
    return;
  }

  target.set("trust proxy", hops);
}
