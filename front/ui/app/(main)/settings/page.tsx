"use client";

import { useEffect, useState } from "react";
import {
  GearSix,
  Bell,
  User,
  Database,
  Key,
  Palette,
  Moon,
  Sun,
  X,
  MagnifyingGlass,
  ArrowSquareOut,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useModelCatalog, useProviderModels } from "@/hooks/useApi";
import {
  ORCHESTRATION_STORAGE_KEY,
  loadOrchestrationSettings,
  type OrchestrationSettings,
} from "@/lib/orchestration";
import type { ProviderModelsResponse } from "@/types";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [notifications, setNotifications] = useState(true);
  const [apiKey, setApiKey] = useState("");

  const [initial] = useState<OrchestrationSettings>(loadOrchestrationSettings);
  const [selectedProvider, setSelectedProvider] = useState(initial.selectedProvider);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(initial.apiKeys);
  const [defaultEmbeddingModel, setDefaultEmbeddingModel] = useState(initial.defaultEmbeddingModel);
  const [defaultAnswerModel, setDefaultAnswerModel] = useState(initial.defaultAnswerModel);
  const [defaultJudgeModel, setDefaultJudgeModel] = useState(initial.defaultJudgeModel);

  const [providerModels, setProviderModels] = useState<ProviderModelsResponse | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");

  const { data: catalog } = useModelCatalog();
  const fetchModelsMutation = useProviderModels();

  const dynamicProviders = catalog?.dynamicProviders ?? [];
  const selectedProviderInfo = dynamicProviders.find((p) => p.id === selectedProvider);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const settings: OrchestrationSettings = {
      selectedProvider,
      apiKeys,
      defaultEmbeddingModel,
      defaultAnswerModel,
      defaultJudgeModel,
    };
    window.localStorage.setItem(ORCHESTRATION_STORAGE_KEY, JSON.stringify(settings));
  }, [selectedProvider, apiKeys, defaultEmbeddingModel, defaultAnswerModel, defaultJudgeModel]);

  const handleThemeChange = (value: "light" | "dark") => {
    setTheme(value);
    // Add theme toggle logic here
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setProviderModels(null);
    setModelsError(null);
    setModelSearch("");
    // Model defaults belong to the previous provider — reset for a clean pick.
    setDefaultEmbeddingModel("");
    setDefaultAnswerModel("");
  };

  const handleFetchModels = async () => {
    if (!selectedProvider) return;
    setModelsError(null);
    try {
      const result = await fetchModelsMutation.mutateAsync({
        provider: selectedProvider,
        apiKey: apiKeys[selectedProvider] || undefined,
      });
      setProviderModels(result);
      setDefaultEmbeddingModel("");
      setDefaultAnswerModel("");
    } catch (e) {
      setProviderModels(null);
      setModelsError((e as Error).message);
    }
  };

  const filterBySearch = (items: { id: string; label: string }[]) => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => m.label.toLowerCase().includes(q));
  };

  const embeddingOptions = filterBySearch(providerModels?.embed ?? []);
  const answerOptions = filterBySearch(providerModels?.answer ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="orchestration">Orchestration</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>
                Basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value="admin" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value="admin@openbox.local" disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>
                Choose what notifications to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label>Email notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">API Configuration</CardTitle>
              <CardDescription>
                Configure your API settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url">API URL</Label>
                <Input
                  id="api-url"
                  value={process.env.NEXT_PUBLIC_API_URL || "https://openbox.fly.dev"}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Database</CardTitle>
              <CardDescription>
                Database connection settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="db-host">Host</Label>
                <Input id="db-host" value="localhost:5432" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-name">Database Name</Label>
                <Input id="db-name" value="openbox" disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>
                Choose your preferred color scheme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("light")}
                  className="flex-1 flex items-center gap-2"
                >
                  <Sun className="w-4 h-4" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("dark")}
                  className="flex-1 flex items-center gap-2"
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Display</CardTitle>
              <CardDescription>
                Customize how content is displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label>Animate UI</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable smooth animations
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label>Show IDs</Label>
                    <p className="text-xs text-muted-foreground">
                      Display resource IDs in tables
                    </p>
                  </div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orchestration" className="space-y-6 mt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Orchestration</h2>
              <p className="text-muted-foreground">
                Pick a provider, paste your API key and bring its models. Defaults apply to new boxes.
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <GearSix className="w-5 h-5" />
                  Provider & API Key
                </CardTitle>
                <CardDescription>
                  The key is stored locally in your browser and used only to list models.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={selectedProvider || undefined} onValueChange={handleProviderChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {dynamicProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                            {p.publicListing ? " (no key needed)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProviderInfo && (
                      <a
                        href={selectedProviderInfo.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ArrowSquareOut className="w-3 h-3" />
                        Get an API key for {selectedProviderInfo.label}
                      </a>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={selectedProviderInfo?.publicListing ? "Optional (public listing)" : "Enter API key"}
                        value={apiKeys[selectedProvider] || ""}
                        onChange={(e) =>
                          setApiKeys({ ...apiKeys, [selectedProvider]: e.target.value })
                        }
                        disabled={!selectedProvider}
                      />
                      <Button
                        onClick={handleFetchModels}
                        disabled={!selectedProvider || fetchModelsMutation.isPending}
                      >
                        {fetchModelsMutation.isPending ? (
                          <GearSix className="w-4 h-4 animate-spin" />
                        ) : (
                          <MagnifyingGlass className="w-4 h-4" />
                        )}
                        Fetch
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Stored locally in your browser. The server uses its own keys (.env) to run inference.
                    </p>
                  </div>
                </div>

                {modelsError && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <WarningCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="break-all">{modelsError}</span>
                  </div>
                )}

                {providerModels && (
                  <p className="text-xs text-muted-foreground">
                    {providerModels.embed.length} embedding · {providerModels.answer.length} answer models found
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MagnifyingGlass className="w-5 h-5" />
                  Default Models
                </CardTitle>
                <CardDescription>
                  Used as the default for new boxes. Judge: Jev or the built-in classifier (uses the answer model).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Filter models</Label>
                  <Input
                    placeholder="Type to filter the model list..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Embedding Model</Label>
                    <Select value={defaultEmbeddingModel || undefined} onValueChange={setDefaultEmbeddingModel}>
                      <SelectTrigger>
                        <SelectValue placeholder={providerModels ? "Select embedding model" : "Fetch models first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {embeddingOptions.map((m) => (
                          <SelectItem key={m.id} value={`${selectedProvider}:${m.id}`}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Answer Model</Label>
                    <Select value={defaultAnswerModel || undefined} onValueChange={setDefaultAnswerModel}>
                      <SelectTrigger>
                        <SelectValue placeholder={providerModels ? "Select answer model" : "Fetch models first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {answerOptions.map((m) => (
                          <SelectItem key={m.id} value={`${selectedProvider}:${m.id}`}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Judge Model</Label>
                    <Select value={defaultJudgeModel || undefined} onValueChange={setDefaultJudgeModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select judge model" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalog?.judgeModels ?? []).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label} — {m.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Saved API Keys
                </CardTitle>
                <CardDescription>
                  Manage your stored API keys (stored locally in browser)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(apiKeys).filter(([, key]) => key.length > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No API keys saved yet. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(apiKeys)
                      .filter(([, key]) => key.length > 0)
                      .map(([provider, key]) => (
                        <div key={provider} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">
                              {dynamicProviders.find((p) => p.id === provider)?.label ?? provider}
                            </Badge>
                            <span className="font-mono text-sm text-muted-foreground">
                              {key.slice(0, 8)}...{key.slice(-4)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              const newKeys = { ...apiKeys };
                              delete newKeys[provider];
                              setApiKeys(newKeys);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
