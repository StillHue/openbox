"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Key, UserPlus, WarningCircle } from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authApi,
  loadAuthToken,
  saveAuthToken,
} from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "login" | "setup">("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loadAuthToken()) {
      router.replace("/");
      return;
    }
    authApi
      .status()
      .then((s) => setMode(s.setupRequired ? "setup" : "login"))
      .catch(() => setMode("login"));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const result =
        mode === "setup"
          ? await authApi.register(email.trim(), password, name.trim() || undefined)
          : await authApi.login(email.trim(), password);
      if (!result.ok || !result.token) {
        throw new Error(result.error ?? "Sign in failed");
      }
      saveAuthToken(result.token);
      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  if (mode === "loading") return null;

  const isSetup = mode === "setup";
  const valid = email.trim().length > 0 && password.length >= (isSetup ? 8 : 1);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSetup ? <UserPlus className="w-5 h-5" /> : <Key className="w-5 h-5" />}
            OpenBox
          </CardTitle>
          <CardDescription>
            {isSetup
              ? "Create the first account to get started"
              : "Sign in with your email and password"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <WarningCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-all">{error}</span>
              </div>
            )}
            {isSetup && (
              <div className="space-y-2">
                <Label htmlFor="login-name">Name</Label>
                <Input
                  id="login-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete={isSetup ? "new-password" : "current-password"}
                placeholder={isSetup ? "Minimum 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={!valid || pending}>
              {pending ? "Please wait..." : isSetup ? "Create account" : "Sign in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
