"use client";

import { Check, Copy, Key, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
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
import { Badge } from "@/components/ui/badge";
import type { ApiKeySettings } from "../hooks/useApiKeySettings";

type ApiTabProps = {
  apiKeys: ApiKeySettings;
};

export function ApiTab({ apiKeys }: ApiTabProps) {
  const {
    openboxKey,
    newKeyName,
    setNewKeyName,
    justCreated,
    copied,
    keysError,
    apiKeysList,
    createKeyPending,
    revokeKeyPending,
    handleOpenboxKeyChange,
    handleCreateKey,
    handleCopyKey,
    handleRevokeKey,
  } = apiKeys;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API Configuration</CardTitle>
          <CardDescription>Configure your API settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">API URL</Label>
            <Input
              id="api-url"
              value={
                process.env.NEXT_PUBLIC_API_URL || "https://openbox.fly.dev"
              }
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">Auth Token</Label>
            <Input
              id="api-key"
              type="password"
              value={openboxKey}
              onChange={(e) => handleOpenboxKeyChange(e.target.value)}
              placeholder="Set automatically at sign in"
            />
            <p className="text-xs text-muted-foreground">
              Stored locally in your browser and sent as Bearer on every
              request. Managed via sign in.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            OpenBox API Keys
          </CardTitle>
          <CardDescription>
            Keys for MCP clients and external integrations. Only hashes are
            stored server-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. claude-desktop)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <Button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim() || createKeyPending}
            >
              <Plus className="w-4 h-4" />
              Generate
            </Button>
          </div>

          {keysError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <WarningCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-all">{keysError}</span>
            </div>
          )}

          {justCreated && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">
                Copy now — this key will never be shown again:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm break-all bg-background p-2 rounded border">
                  {justCreated.key}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopyKey}>
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {(apiKeysList ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No API keys yet. Generate one above.
            </p>
          ) : (
            <div className="space-y-2">
              {(apiKeysList ?? []).map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{k.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {k.keyPrefix}...
                        {k.lastUsedAt
                          ? ` · used ${new Date(k.lastUsedAt).toLocaleString()}`
                          : " · never used"}
                      </p>
                    </div>
                    {k.revokedAt && (
                      <Badge variant="destructive">revoked</Badge>
                    )}
                  </div>
                  {!k.revokedAt && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={revokeKeyPending}
                      onClick={() => handleRevokeKey(k.id, k.name)}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Database</CardTitle>
          <CardDescription>Database connection settings</CardDescription>
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
    </div>
  );
}
