"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
    />
  )
}

function Message({
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end"
}) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn("group/message flex w-full gap-3", align === "end" && "flex-row-reverse", className)}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn("flex shrink-0 items-end [&_svg]:size-4", className)}
      {...props}
    />
  )
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1",
        "group-data-[align=end]/message:items-end",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        "group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  )
}

export {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
}
