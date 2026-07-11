import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelOverview, AiModelTestResult, RagflowModelOverview } from "../types";

const apiModule = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly code?: string
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return { api: vi.fn(), ApiError };
});

vi.mock("../api", () => apiModule);

import { AiModelAccessPage } from "./AiModelAccessPage";

describe("AiModelAccessPage", () => {
  beforeEach(() => {
    apiModule.api.mockImplementation(defaultApi);
  });

  afterEach(() => {
    apiModule.api.mockReset();
  });

  it("loads the sanitized saved configuration without hydrating the API-key input", async () => {
    render(<AiModelAccessPage />);

    expect(await screen.findByRole("heading", { name: "AI 模型接入" })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("模型 ID")).toHaveValue("qwen-plus"));
    expect(screen.getByLabelText("API Key")).toHaveValue("");
    expect(screen.getByText("运行中")).toBeTruthy();
    expect(screen.getByText("database")).toBeTruthy();
    expect(screen.getByText("passed")).toBeTruthy();
    expect(document.body.textContent).not.toContain("encrypted");
  });

  it("prefills canonical provider endpoints and requires a custom URL", async () => {
    render(<AiModelAccessPage />);
    await waitFor(() => expect(screen.getByLabelText("模型 ID")).toHaveValue("qwen-plus"));

    await chooseOption("服务商", "DeepSeek");
    await waitFor(() =>
      expect(screen.getByLabelText("Base URL")).toHaveValue("https://api.deepseek.com")
    );

    await chooseOption("服务商", "自定义");
    await waitFor(() => expect(screen.getByLabelText("Base URL")).toHaveValue(""));
    fireEvent.click(screen.getByRole("button", { name: /测试连接/ }));
    expect(await screen.findByText("请输入 Base URL")).toBeTruthy();
  });

  it("omits a blank key and keeps failed candidate state separate from saved evidence", async () => {
    apiModule.api.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.endsWith("/generation/test") && options?.method === "POST") {
        return Promise.resolve({
          ok: false,
          provider: "bailian",
          model: "qwen-plus",
          elapsedMs: 25,
          errorCode: "MODEL_AUTHENTICATION_FAILED"
        } satisfies AiModelTestResult);
      }
      return defaultApi(path, options);
    });
    render(<AiModelAccessPage />);
    await waitFor(() => expect(screen.getByLabelText("模型 ID")).toHaveValue("qwen-plus"));

    fireEvent.click(screen.getByRole("button", { name: /测试连接/ }));

    expect(await screen.findByText("API Key 无效或无权限")).toBeTruthy();
    expect(screen.getByText("passed")).toBeTruthy();
    const call = apiModule.api.mock.calls.find(([path]) => String(path).endsWith("/generation/test"));
    expect(call?.[1]?.body).not.toHaveProperty("apiKey");
  });

  it("sends a replacement key and clears it after successful save", async () => {
    render(<AiModelAccessPage />);
    await waitFor(() => expect(screen.getByLabelText("模型 ID")).toHaveValue("qwen-plus"));
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "replacement-secret" } });

    fireEvent.click(screen.getByRole("button", { name: /保存并启用/ }));

    await waitFor(() => {
      const call = apiModule.api.mock.calls.find(
        ([path, options]) => path === "/api/internal/ai-models/generation" && options?.method === "PUT"
      );
      expect(call?.[1]?.body).toEqual(expect.objectContaining({ apiKey: "replacement-secret" }));
    });
    await waitFor(() => expect(screen.getByLabelText("API Key")).toHaveValue(""));
    expect(document.body.textContent).not.toContain("replacement-secret");
  });

  it("keeps test and save loading states independent", async () => {
    const testRequest = deferred<AiModelTestResult>();
    apiModule.api.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.endsWith("/generation/test") && options?.method === "POST") {
        return testRequest.promise;
      }
      return defaultApi(path, options);
    });
    render(<AiModelAccessPage />);
    await waitFor(() => expect(screen.getByLabelText("模型 ID")).toHaveValue("qwen-plus"));

    fireEvent.click(screen.getByRole("button", { name: /测试连接/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /测试连接/ })).toHaveClass("ant-btn-loading")
    );
    expect(screen.getByRole("button", { name: /保存并启用/ })).not.toBeDisabled();
    testRequest.resolve({ ok: true, provider: "bailian", model: "qwen-plus", elapsedMs: 20 });
    expect(await screen.findByText("连接测试通过")).toBeTruthy();
  });

  it("renders RAGFlow state as read-only and refreshes it independently", async () => {
    render(<AiModelAccessPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "RAGFlow 模型状态" }));

    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByText("PAS QA")).toBeTruthy();
    expect(within(panel).getByText("text-embedding-v3")).toBeTruthy();
    expect(within(panel).getAllByText("不可用").length).toBeGreaterThan(0);
    expect(within(panel).queryByRole("textbox")).toBeNull();

    fireEvent.click(within(panel).getByRole("button", { name: "刷新 RAGFlow 状态" }));
    await waitFor(() => {
      expect(
        apiModule.api.mock.calls.filter(([path]) => path === "/api/internal/ai-models/ragflow").length
      ).toBeGreaterThanOrEqual(2);
    });
  });
});

async function chooseOption(label: string, optionText: string): Promise<void> {
  fireEvent.mouseDown(screen.getByLabelText(label));
  await waitFor(() =>
    expect(screen.getAllByRole("option").some((option) => option.textContent === optionText)).toBe(true)
  );
  fireEvent.click(screen.getAllByRole("option").find((option) => option.textContent === optionText)!);
}

function defaultApi(path: string, options?: { method?: string }): Promise<unknown> {
  if (path === "/api/internal/ai-models/overview") {
    return Promise.resolve(createOverview());
  }
  if (path === "/api/internal/ai-models/ragflow") {
    return Promise.resolve(createRagflowOverview());
  }
  if (path === "/api/internal/ai-models/generation" && options?.method === "PUT") {
    return Promise.resolve(createOverview());
  }
  if (path === "/api/internal/ai-models/generation" && options?.method === "DELETE") {
    return Promise.resolve({
      ...createOverview(),
      generation: { ...createOverview().generation, source: "environment" }
    });
  }
  if (path.endsWith("/generation/test")) {
    return Promise.resolve({ ok: true, provider: "bailian", model: "qwen-plus", elapsedMs: 20 });
  }
  return Promise.resolve({});
}

function createOverview(): AiModelOverview {
  return {
    providers: [
      { provider: "bailian", label: "百炼 (Bailian)", defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
      { provider: "deepseek", label: "DeepSeek", defaultBaseUrl: "https://api.deepseek.com" },
      { provider: "openai", label: "OpenAI", defaultBaseUrl: "https://api.openai.com/v1" },
      { provider: "custom", label: "自定义", defaultBaseUrl: "" }
    ],
    generation: {
      status: "running",
      source: "database",
      provider: "bailian",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
      keyConfigured: true,
      timeoutSeconds: 30,
      lastTestStatus: "passed",
      lastTestedAt: "2026-07-11T00:00:00.000Z",
      updatedBy: "admin-1",
      updatedAt: "2026-07-11T00:00:00.000Z"
    },
    savedConfiguration: {
      enabled: true,
      provider: "bailian",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
      keyConfigured: true,
      timeoutSeconds: 30,
      lastTestStatus: "passed",
      lastTestedAt: "2026-07-11T00:00:00.000Z",
      updatedBy: "admin-1",
      updatedAt: "2026-07-11T00:00:00.000Z"
    }
  };
}

function createRagflowOverview(): RagflowModelOverview {
  return {
    status: "ok",
    baseUrl: "http://ragflow.local",
    dataset: {
      datasetId: "qa-v0",
      name: "PAS QA",
      embeddingModel: "text-embedding-v3",
      documentCount: 20,
      chunkCount: 500
    },
    unavailableFields: ["rerankerModel", "chatModel", "language", "chunkMethod"],
    refreshedAt: "2026-07-11T00:00:00.000Z"
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
