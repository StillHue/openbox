/**
 * Account-level orchestration settings (Settings → Orchestration tab).
 * Stored in localStorage so they survive reloads without requiring user accounts.
 * These act as the default provider/models for newly created boxes.
 */

export const ORCHESTRATION_STORAGE_KEY = "openbox.orchestration";

export type OrchestrationSettings = {
  selectedProvider: string;
  apiKeys: Record<string, string>;
  defaultEmbeddingModel: string;
  defaultAnswerModel: string;
  defaultJudgeModel: string;
};

const EMPTY_SETTINGS: OrchestrationSettings = {
  selectedProvider: "",
  apiKeys: {},
  defaultEmbeddingModel: "",
  defaultAnswerModel: "",
  defaultJudgeModel: "",
};

export function loadOrchestrationSettings(): OrchestrationSettings {
  if (typeof window === "undefined") return EMPTY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(ORCHESTRATION_STORAGE_KEY);
    if (!raw) return EMPTY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<OrchestrationSettings>;
    return {
      selectedProvider: parsed.selectedProvider ?? "",
      apiKeys: parsed.apiKeys ?? {},
      defaultEmbeddingModel: parsed.defaultEmbeddingModel ?? "",
      defaultAnswerModel: parsed.defaultAnswerModel ?? "",
      defaultJudgeModel: parsed.defaultJudgeModel ?? "",
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}
