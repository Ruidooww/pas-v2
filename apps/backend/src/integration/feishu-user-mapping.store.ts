export class FeishuUserMappingStore {
  private readonly pasUserIdsByFeishuUserId = new Map<string, string>();

  set(feishuUserId: string, pasUserId: string): void {
    this.pasUserIdsByFeishuUserId.set(feishuUserId, pasUserId);
  }

  get(feishuUserId: string): string | undefined {
    return this.pasUserIdsByFeishuUserId.get(feishuUserId);
  }
}
