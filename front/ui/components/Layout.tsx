"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  SignOut,
  UserCircle,
  Key,
  GearSix,
} from "@phosphor-icons/react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/useApi";
import { saveOpenboxApiKey } from "@/services/api";
import { toast } from "@/lib/toast";

interface LayoutProps {
  children: React.ReactNode;
}

/** Two-letter monogram: explicit name first, otherwise the email's first part. */
function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function TopSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/boxes${value.trim() ? `?search=${encodeURIComponent(value.trim())}` : ""}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-sm">
      <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="buscar"
        className="pl-9 bg-card border-border"
      />
    </form>
  );
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { data: user } = useCurrentUser();

  const handleSignOut = () => {
    saveOpenboxApiKey("");
    toast.add({
      title: "Sessão encerrada",
      description: "Você saiu do OpenBox.",
      type: "info",
    });
    router.replace("/login");
  };

  const goToSettings = (tab: string) => {
    router.push(`/settings?tab=${tab}`);
  };

  const displayName = user?.name?.trim() || user?.email || "Conta";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 px-4">
          <SidebarTrigger className="-ml-1" />
          <TopSearch />
          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Conta"
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="bg-blue-950 text-blue-200 text-xs font-semibold">
                      {initialsFor(user?.name, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  {user?.email && (
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => goToSettings("general")}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Minha conta
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => goToSettings("api")}>
                  <Key className="mr-2 h-4 w-4" />
                  Chaves de API
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => goToSettings("orchestration")}>
                  <GearSix className="mr-2 h-4 w-4" />
                  Orquestração
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                  <SignOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 px-6 pb-8 pt-2 container mx-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
