import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Header } from "./header";
import { CommandBar } from "@/components/command/command-bar";
import { QuickActionHost } from "@/components/quick/quick-action-host";
import { useApp } from "@/features/app/app-context";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { workspaceName } = useApp();

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        workspaceName={workspaceName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          <div className="mx-auto w-full max-w-5xl space-y-8">{children}</div>
        </main>
      </div>
      <BottomNav />
      <CommandBar />
      <QuickActionHost />
    </div>
  );
}
