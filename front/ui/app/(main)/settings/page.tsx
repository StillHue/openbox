"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfileSettings } from "./hooks/useProfileSettings";
import { useApiKeySettings } from "./hooks/useApiKeySettings";
import { useOrchestrationSettings } from "./hooks/useOrchestrationSettings";
import { GeneralTab } from "./components/GeneralTab";
import { ApiTab } from "./components/ApiTab";
import { AppearanceTab, type AppearanceTheme } from "./components/AppearanceTab";
import { OrchestrationTab } from "./components/OrchestrationTab";

export default function SettingsPage() {
  const [theme, setTheme] = useState<AppearanceTheme>("light");

  const profile = useProfileSettings();
  const apiKeySettings = useApiKeySettings();
  const orchestration = useOrchestrationSettings();

  // Deep-link from the header account menu (?tab=general|api|orchestration).
  const activeTab = useSearchParams().get("tab") ?? "general";

  const handleThemeChange = (value: AppearanceTheme) => {
    setTheme(value);
    // Add theme toggle logic here
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences</p>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="orchestration">Orchestration</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <GeneralTab profile={profile} />
        </TabsContent>

        <TabsContent value="api" className="space-y-6 mt-6">
          <ApiTab apiKeys={apiKeySettings} />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6 mt-6">
          <AppearanceTab theme={theme} onThemeChange={handleThemeChange} />
        </TabsContent>

        <TabsContent value="orchestration" className="space-y-6 mt-6">
          <OrchestrationTab orchestration={orchestration} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
