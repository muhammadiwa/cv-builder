"use client";

import { useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Sparkles, Target, Palette, ChevronRight, ChevronLeft } from "lucide-react";
import { useEditorLayoutStore, type RightPanelTab } from "@/stores/editorLayoutStore";
import {
  AIPanelPlaceholder,
  ATSPanelPlaceholder,
  TemplatePanelPlaceholder,
} from "./RightPanelPlaceholders";

const TABS: { value: RightPanelTab; label: string; Icon: typeof Sparkles }[] = [
  { value: "ai", label: "AI", Icon: Sparkles },
  { value: "ats", label: "ATS", Icon: Target },
  { value: "template", label: "Template", Icon: Palette },
];

/**
 * Desktop right panel. Tabs persist via the layout store; pressing `Esc`
 * collapses the panel.
 */
export function RightPanel() {
  const tab = useEditorLayoutStore((s) => s.rightPanelTab);
  const setTab = useEditorLayoutStore((s) => s.setRightPanelTab);
  const collapsed = useEditorLayoutStore((s) => s.rightPanelCollapsed);
  const toggle = useEditorLayoutStore((s) => s.toggleRightPanel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !collapsed) {
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, toggle]);

  if (collapsed) {
    return (
      <aside className="h-full flex flex-col items-center border-l bg-background py-2">
        <button
          type="button"
          onClick={toggle}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          aria-label="Bentangkan panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="h-full flex flex-col border-l bg-background"
      aria-label="Side panel"
    >
      <Tabs.Root
        value={tab}
        onValueChange={(v) => setTab(v as RightPanelTab)}
        className="flex flex-col h-full"
      >
        <div className="flex items-center justify-between border-b">
          <Tabs.List className="flex" aria-label="Right panel tabs">
            {TABS.map(({ value, label, Icon }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm",
                  "text-muted-foreground hover:text-foreground transition-colors",
                  "data-[state=active]:text-foreground",
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <button
            type="button"
            onClick={toggle}
            className="mr-2 p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Ciutkan panel"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <Tabs.Content value="ai" className="flex-1 outline-none">
          <AIPanelPlaceholder />
        </Tabs.Content>
        <Tabs.Content value="ats" className="flex-1 outline-none">
          <ATSPanelPlaceholder />
        </Tabs.Content>
        <Tabs.Content value="template" className="flex-1 outline-none">
          <TemplatePanelPlaceholder />
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
