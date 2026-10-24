"use client";

import { useState } from "react";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "@/hooks/useApi";
import { loadOpenboxApiKey, saveOpenboxApiKey } from "@/services/api";
import type { CreateApiKeyResponse } from "@/types";
import { errorMessage, toast } from "@/lib/toast";

export function useApiKeySettings() {
  const [openboxKey, setOpenboxKey] = useState(loadOpenboxApiKey);
  const [newKeyName, setNewKeyName] = useState("");
  const [justCreated, setJustCreated] =
    useState<CreateApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);

  const { data: apiKeysList } = useApiKeys();
  const createKeyMutation = useCreateApiKey();
  const revokeKeyMutation = useRevokeApiKey();

  const handleOpenboxKeyChange = (value: string) => {
    setOpenboxKey(value);
    saveOpenboxApiKey(value);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setKeysError(null);
    setJustCreated(null);
    setCopied(false);
    const keyName = newKeyName.trim();
    try {
      const created = await toast.promise(
        createKeyMutation.mutateAsync(keyName),
        {
          loading: { title: "Gerando chave…" },
          success: `"${keyName}" criada. Copie agora — não aparece de novo.`,
          error: (e) => errorMessage(e),
        },
      );
      setJustCreated(created);
      setNewKeyName("");
    } catch (e) {
      setKeysError(errorMessage(e));
    }
  };

  const handleCopyKey = async () => {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated.key);
      setCopied(true);
      toast.add({
        title: "Chave copiada",
        description: "Cole no seu cliente MCP.",
        type: "success",
      });
    } catch {
      setKeysError("Could not copy to clipboard");
      toast.add({
        title: "Não foi possível copiar",
        description: "Copie manualmente da caixa acima.",
        type: "error",
      });
    }
  };

  const handleRevokeKey = async (id: string, keyName: string) => {
    setKeysError(null);
    try {
      await toast.promise(revokeKeyMutation.mutateAsync(id), {
        loading: { title: `Revogando "${keyName}"…` },
        success: `"${keyName}" revogada. Clientes usando essa chave perdem o acesso.`,
        error: (e) => errorMessage(e),
      });
    } catch (e) {
      setKeysError(errorMessage(e));
    }
  };

  return {
    openboxKey,
    newKeyName,
    setNewKeyName,
    justCreated,
    copied,
    keysError,
    apiKeysList,
    createKeyPending: createKeyMutation.isPending,
    revokeKeyPending: revokeKeyMutation.isPending,
    handleOpenboxKeyChange,
    handleCreateKey,
    handleCopyKey,
    handleRevokeKey,
  };
}

export type ApiKeySettings = ReturnType<typeof useApiKeySettings>;
