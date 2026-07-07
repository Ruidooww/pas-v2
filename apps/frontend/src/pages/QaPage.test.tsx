import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QaPage } from "./QaPage";

describe("QaPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("does not emit deprecated Ant Design Alert warnings when rendering an answer", async () => {
    localStorage.setItem("pas.access-token", "test-token");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          questionId: "q-1",
          status: "answered",
          answer: "文档加密支持透明加密和审批外发。",
          citations: []
        })
      })
    );

    render(<QaPage />);

    fireEvent.change(screen.getByPlaceholderText(/IP-Guard/), { target: { value: "文档加密支持哪些模式？" } });
    fireEvent.click(screen.getByRole("button", { name: "提 问" }));

    expect(await screen.findByText("文档加密支持透明加密和审批外发。")).toBeInTheDocument();
    const messages = consoleError.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(messages).not.toContain("[antd: Alert]");
  });
});
