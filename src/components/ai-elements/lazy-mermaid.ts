import type { DiagramPlugin } from "streamdown";

type LoadPlugin = () => Promise<Pick<DiagramPlugin, "getMermaid">>;

/** Keep Mermaid's module initialization out of the application's startup graph. */
export function createLazyMermaidPlugin(
  load: LoadPlugin = async () => (await import("@streamdown/mermaid")).mermaid,
): DiagramPlugin {
  let loaded: ReturnType<LoadPlugin> | undefined;
  return {
    name: "mermaid",
    type: "diagram",
    language: "mermaid",
    getMermaid(initialConfig) {
      let config = initialConfig;
      return {
        initialize(nextConfig) {
          config = nextConfig;
        },
        async render(id, source) {
          loaded ??= load();
          const plugin = await loaded;
          return plugin.getMermaid(config).render(id, source);
        },
      };
    },
  };
}

export const lazyMermaid = createLazyMermaidPlugin();