import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { expect, it, vi } from "vitest";

const accountsModule = vi.hoisted(() => ({ loadCount: 0 }));
const aiModelModule = vi.hoisted(() => ({ loadCount: 0 }));

vi.mock("./pages/AccountsPage", () => {
  accountsModule.loadCount += 1;
  return {
    AccountsPage: () => <div>Deferred accounts page</div>
  };
});

vi.mock("./pages/AiModelAccessPage", () => {
  aiModelModule.loadCount += 1;
  return {
    AiModelAccessPage: () => <div>Deferred AI model page</div>
  };
});

it("loads an authenticated page module only when its lazy component renders", async () => {
  expect(accountsModule.loadCount).toBe(0);
  const { AccountsPage } = await import("./lazy-pages");
  expect(accountsModule.loadCount).toBe(0);

  render(
    <Suspense fallback={<div>Loading page</div>}>
      <AccountsPage />
    </Suspense>
  );

  expect(await screen.findByText("Deferred accounts page")).toBeTruthy();
  expect(accountsModule.loadCount).toBe(1);
});

it("keeps the AI model page lazy until its component renders", async () => {
  expect(aiModelModule.loadCount).toBe(0);
  const { AiModelAccessPage } = await import("./lazy-pages");
  expect(aiModelModule.loadCount).toBe(0);

  render(
    <Suspense fallback={<div>Loading page</div>}>
      <AiModelAccessPage />
    </Suspense>
  );

  expect(await screen.findByText("Deferred AI model page")).toBeTruthy();
  expect(aiModelModule.loadCount).toBe(1);
});
