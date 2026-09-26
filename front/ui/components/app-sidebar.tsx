"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Package,
  Graph,
  ChatCircle,
  GearSix,
} from "@phosphor-icons/react"

import { useBoxes } from "@/hooks/useApi"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navItems = [
  { path: "/boxes", label: "Boxes", icon: Package },
  { path: "/graph", label: "Graph", icon: Graph },
  { path: "/chat", label: "Chat", icon: ChatCircle },
  { path: "/settings", label: "Settings", icon: GearSix },
]

export function AppSidebar() {
  const pathname = usePathname() ?? ""
  const { data: boxes } = useBoxes()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/boxes" className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-openbox.png"
                  alt="OpenBox"
                  className="h-8 w-auto group-data-[collapsible=icon]:hidden"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-openbox.png"
                  alt="OpenBox"
                  className="hidden size-8 group-data-[collapsible=icon]:block"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.path ||
                  pathname.startsWith(`${item.path}/`)
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.path}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {(boxes ?? []).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Boxes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(boxes ?? []).map((box) => (
                  <SidebarMenuItem key={box.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/boxes/${box.id}`}
                      tooltip={box.name}
                    >
                      <Link href={`/boxes/${box.id}`}>
                        <Package />
                        <span>{box.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <GearSix />
                <span>v1.0.0</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
