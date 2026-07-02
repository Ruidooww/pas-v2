export type FeishuIntegrationConfig = {
  enabled: boolean;
  webhookSecret: string;
};

export type FeishuCallbackHeaders = {
  timestamp: string;
  nonce: string;
  signature: string;
};

export type FeishuMessageEvent = {
  type: "message";
  messageId: string;
  feishuUserId: string;
  text: string;
};

export type FeishuUrlVerificationEvent = {
  type: "url_verification";
  challenge: string;
};

export type FeishuCallbackEvent = FeishuMessageEvent | FeishuUrlVerificationEvent;

export type FeishuCallbackResponse =
  | {
      status: "disabled";
    }
  | {
      status: "verified";
      challenge: string;
    }
  | {
      status: "answered";
      messageId: string;
      qaStatus: string;
      answer: string;
    };
