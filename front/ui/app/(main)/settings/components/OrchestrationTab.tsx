"use client";

import {
  ArrowSquareOut,
  GearSix,
  Key,
  MagnifyingGlass,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { OrchestrationSettingsState } from "../hooks/useOrchestrationSettings";

type OrchestrationTabProps = {
  orchestration: OrchestrationSettingsState;
};

export function OrchestrationTab({ orchestration }: OrchestrationTabProps) {
  const {
    selectedProvider,
    apiKeys,
    setApiKeys,
    defaultEmbeddingModel,
    setDefaultEmbeddingModel,
    defaultAnswerModel,
    setDefaultAnswerModel,
    defaultJudgeModel,
    setDefaultJudgeModel,
    providerModels,
    modelsError,
    modelSearch,
    setModelSearch,
    catalog,
    fetchModelsPending,
    dynamicProviders,
    selectedProviderInfo,
    embeddingOptions,
    answerOptions,
    handleProviderChange,
    handleFetchModels,
  } = orchestration;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Orchestration</h2>
        <p className="text-muted-foreground">
          Pick a provider, paste your API key and bring its models. Defaults
          apply to new boxes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <GearSix className="w-5 h-5" />
            Provider & API Key
          </CardTitle>
          <CardDescription>
            The key is stored locally in your browser and used only to list
            models.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={selectedProvider || undefined}
                onValueChange={handleProviderChange}
              >
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
                  placeholder={
                    selectedProviderInfo?.publicListing
                      ? "Optional (public listing)"
                      : "Enter API key"
                  }
                  value={apiKeys[selectedProvider] || ""}
                  onChange={(e) =>
                    setApiKeys({
                      ...apiKeys,
                      [selectedProvider]: e.target.value,
                    })
                  }
                  disabled={!selectedProvider}
                />
                <Button
                  onClick={handleFetchModels}
                  disabled={!selectedProvider || fetchModelsPending}
                >
                  {fetchModelsPending ? (
                    <GearSix className="w-4 h-4 animate-spin" />
                  ) : (
                    <MagnifyingGlass className="w-4 h-4" />
                  )}
                  Fetch
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored locally in your browser. The server uses its own keys
                (.env) to run inference.
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
              {providerModels.embed.length} embedding ·{" "}
              {providerModels.answer.length} answer models found
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
            Used as the default for new boxes. Judge: Jev or the built-in
            classifier (uses the answer model).
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
              <Select
                value={defaultEmbeddingModel || undefined}
                onValueChange={setDefaultEmbeddingModel}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      providerModels
                        ? "Select embedding model"
                        : "Fetch models first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {embeddingOptions.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={`${selectedProvider}:${m.id}`}
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Answer Model</Label>
              <Select
                value={defaultAnswerModel || undefined}
                onValueChange={setDefaultAnswerModel}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      providerModels
                        ? "Select answer model"
                        : "Fetch models first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {answerOptions.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={`${selectedProvider}:${m.id}`}
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Judge Model</Label>
              <Select
                value={defaultJudgeModel || undefined}
                onValueChange={setDefaultJudgeModel}
              >
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
          {Object.entries(apiKeys).filter(([, key]) => key.length > 0)
            .length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No API keys saved yet. Add one above.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(apiKeys)
                .filter(([, key]) => key.length > 0)
                .map(([provider, key]) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {dynamicProviders.find((p) => p.id === provider)
                          ?.label ?? provider}
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
  );
}
