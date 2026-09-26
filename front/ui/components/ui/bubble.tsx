"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const bubbleVariants = cva(
  "w-fit max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-foreground",
        outline: "border bg-background",
      },
      align: {
        start: "rounded-bl-md",
        end: "rounded-br-md",
      },
    },
    defaultVariants: {
      variant: "secondary",
      align: "start",
    },
  }
)

function Bubble({
  className,
  variant,
  align,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bubbleVariants>) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant, align }), className)}
      {...props}
    />
  )
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-content"
      className={cn("whitespace-pre-wrap", className)}
      {...props}
    />
  )
}

export { Bubble, BubbleContent, bubbleVariants }
