"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LayoutProps {
  children: React.ReactNode;
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
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 px-4">
          <SidebarTrigger className="-ml-1" />
          <TopSearch />
          <div className="ml-auto flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-950 text-blue-200 text-xs font-semibold">
                OB
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 px-6 pb-8 pt-2 container mx-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
