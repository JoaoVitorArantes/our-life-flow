import { expect, test, vi } from "vitest";
import { createLazyMermaidPlugin } from "./lazy-mermaid";

test("loads only when rendering and preserves configuration and diagrams", async () => {
  const render = vi.fn(async () => ({ svg: "<svg>diagram</svg>" }));
  const getMermaid = vi.fn(() => ({ initialize: vi.fn(), render }));
  const load = vi.fn(async () => ({ getMermaid }));
  const plugin = createLazyMermaidPlugin(load);
  const instance = plugin.getMermaid({ theme: "dark" });
  instance.initialize({ theme: "neutral" });
  expect(load).not.toHaveBeenCalled();
  await expect(instance.render("first", "graph TD; A-->B")).resolves.toEqual({ svg: "<svg>diagram</svg>" });
  await instance.render("second", "graph TD; B-->C");
  expect(load).toHaveBeenCalledTimes(1);
  expect(getMermaid).toHaveBeenCalledWith({ theme: "neutral" });
  expect(render).toHaveBeenCalledWith("first", "graph TD; A-->B");
});

test("initialization failures reject only rendering without automatic retries", async () => {
  const load = vi.fn(async () => { throw new Error("module initialization failed"); });
  const plugin = createLazyMermaidPlugin(load);
  const instance = plugin.getMermaid();
  expect(load).not.toHaveBeenCalled();
  await expect(instance.render("first", "graph TD; A-->B")).rejects.toThrow("module initialization failed");
  await expect(instance.render("second", "graph TD; A-->B")).rejects.toThrow("module initialization failed");
  expect(load).toHaveBeenCalledTimes(1);
});