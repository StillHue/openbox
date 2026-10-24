"use client";

import { useEffect, useState } from "react";
import { useModelCatalog, useProviderModels } from "@/hooks/useApi";
import {
  ORCHESTRATION_STORAGE_KEY,
  loadOrchestrationSettings,
  type OrchestrationSettings,
} from "@/lib/orchestration";
import type { ProviderModelsResponse } from "@/types";

export function useOrchestrationSettings() {
  const [initial] = useState<OrchestrationSettings>(loadOrchestrationSettings);
  const [selectedProvider, setSelectedProvider] = useState(
    initial.selectedProvider,
  );
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(
    initial.apiKeys,
  );
  const [defaultEmbeddingModel, setDefaultEmbeddingModel] = useState(
    initial.defaultEmbeddingModel,
  );
  const [defaultAnswerModel, setDefaultAnswerModel] = useState(
    initial.defaultAnswerModel,
  );
  const [defaultJudgeModel, setDefaultJudgeModel] = useState(
    initial.defaultJudgeModel,
  );

  const [providerModels, setProviderModels] =
    useState<ProviderModelsResponse | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");

  const { data: catalog } = useModelCatalog();
  const fetchModelsMutation = useProviderModels();

  const dynamicProviders = catalog?.dynamicProviders ?? [];
  const selectedProviderInfo = dynamicProviders.find(
    (p) => p.id === selectedProvider,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const settings: OrchestrationSettings = {
      selectedProvider,
      apiKeys,
      defaultEmbeddingModel,
      defaultAnswerModel,
      defaultJudgeModel,
    };
    window.localStorage.setItem(
      ORCHESTRATION_STORAGE_KEY,
      JSON.stringify(settings),
    );
  }, [
    selectedProvider,
    apiKeys,
    defaultEmbeddingModel,
    defaultAnswerModel,
    defaultJudgeModel,
  ]);

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

  return {
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
    fetchModelsPending: fetchModelsMutation.isPending,
    dynamicProviders,
    selectedProviderInfo,
    embeddingOptions,
    answerOptions,
    handleProviderChange,
    handleFetchModels,
    filterBySearch,
  };
}

export type OrchestrationSettingsState = ReturnType<
  typeof useOrchestrationSettings
>;
