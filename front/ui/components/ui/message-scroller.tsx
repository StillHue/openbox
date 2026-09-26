"use client"

import * as React from "react"
import { ArrowDown } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type ScrollPosition = "start" | "end" | "last-anchor"

interface MessageScrollerContextValue {
  viewportRef: React.RefObject<HTMLDivElement | null>
  registerItem: (id: string, el: HTMLElement | null) => void
  scrollToMessage: (id: string) => boolean
  scrollToEnd: () => void
  scrollToStart: () => void
  handleScroll: () => void
  canScrollDown: boolean
}

const MessageScrollerContext =
  React.createContext<MessageScrollerContextValue | null>(null)

function useMessageScroller() {
  const ctx = React.useContext(MessageScrollerContext)
  if (!ctx) {
    throw new Error("useMessageScroller must be used within a MessageScrollerProvider.")
  }
  return ctx
}

const BOTTOM_THRESHOLD = 96

function MessageScrollerProvider({
  autoScroll = true,
  defaultScrollPosition = "end",
  scrollPreviousItemPeek = 64,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  autoScroll?: boolean
  defaultScrollPosition?: ScrollPosition
  scrollPreviousItemPeek?: number
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const itemsRef = React.useRef(new Map<string, HTMLElement>())
  const [canScrollDown, setCanScrollDown] = React.useState(false)
  const openedRef = React.useRef(false)

  const isNearBottom = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
  }, [])

  const updateScrollState = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > BOTTOM_THRESHOLD)
  }, [])

  const scrollToEnd = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior })
  }, [])

  const scrollToStart = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    viewportRef.current?.scrollTo({ top: 0, behavior })
  }, [])

  const scrollToMessage = React.useCallback((id: string) => {
    const el = itemsRef.current.get(id)
    if (!el) return false
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    return true
  }, [])

  const registerItem = React.useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) {
        const isNew = !itemsRef.current.has(id)
        itemsRef.current.set(id, el)
        if (!isNew || !openedRef.current) return
        const anchor = el.hasAttribute("data-scroll-anchor")
        if (anchor) {
          const top = el.offsetTop - scrollPreviousItemPeek
          viewportRef.current?.scrollTo({ top: Math.max(top, 0), behavior: "smooth" })
        } else if (autoScroll && isNearBottom()) {
          scrollToEnd()
        }
      } else {
        itemsRef.current.delete(id)
      }
    },
    [autoScroll, isNearBottom, scrollPreviousItemPeek, scrollToEnd]
  )

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el || openedRef.current) return
    openedRef.current = true
    updateScrollState()
    if (defaultScrollPosition === "start") {
      el.scrollTop = 0
    } else if (defaultScrollPosition === "end") {
      el.scrollTop = el.scrollHeight
    } else {
      const anchors = el.querySelectorAll("[data-scroll-anchor]")
      const last = anchors[anchors.length - 1] as HTMLElement | undefined
      if (last) {
        el.scrollTop = Math.max(last.offsetTop - scrollPreviousItemPeek, 0)
      } else {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [defaultScrollPosition, scrollPreviousItemPeek, updateScrollState])

  const value = React.useMemo(
    () => ({
      viewportRef,
      registerItem,
      scrollToMessage,
      scrollToEnd: () => scrollToEnd(),
      scrollToStart: () => scrollToStart(),
      handleScroll: () => updateScrollState(),
      canScrollDown,
    }),
    [registerItem, scrollToMessage, scrollToEnd, scrollToStart, updateScrollState, canScrollDown]
  )

  return (
    <MessageScrollerContext.Provider value={value}>
      <div
        data-slot="message-scroller-provider"
        className={cn("flex h-full min-h-0 flex-col", className)}
        {...props}
      >
        {children}
      </div>
    </MessageScrollerContext.Provider>
  )
}

function MessageScroller({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-scroller"
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const ctx = React.useContext(MessageScrollerContext)
  return (
    <div
      data-slot="message-scroller-viewport"
      ref={ctx?.viewportRef}
      role="region"
      aria-label="Messages"
      tabIndex={0}
      onScroll={() => ctx?.handleScroll()}
      className={cn("min-h-0 flex-1 overflow-y-auto outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function MessageScrollerContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-scroller-content"
      role="log"
      aria-relevant="additions"
      className={cn("flex flex-col gap-4 p-4", className)}
      {...props}
    />
  )
}

function MessageScrollerItem({
  messageId,
  scrollAnchor = false,
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  messageId: string
  scrollAnchor?: boolean
  ref?: React.Ref<HTMLDivElement>
}) {
  const { registerItem } = useMessageScroller()
  const localRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    registerItem(messageId, localRef.current)
    return () => registerItem(messageId, null)
  }, [messageId, registerItem])

  return (
    <div
      data-slot="message-scroller-item"
      data-message-id={messageId}
      {...(scrollAnchor ? { "data-scroll-anchor": "" } : {})}
      ref={(node) => {
        localRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      className={cn("[content-visibility:auto] [contain-intrinsic-size:auto_80px]", className)}
      {...props}
    />
  )
}

function MessageScrollerButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { canScrollDown, scrollToEnd } = useMessageScroller()
  return (
    <Button
      data-slot="message-scroller-button"
      data-active={canScrollDown}
      variant="outline"
      size="icon"
      tabIndex={canScrollDown ? 0 : -1}
      onClick={() => scrollToEnd()}
      className={cn(
        "absolute bottom-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full shadow-md transition-opacity",
        !canScrollDown && "pointer-events-none opacity-0",
        className
      )}
      {...props}
    >
      <ArrowDown className="h-4 w-4" />
      <span className="sr-only">Jump to latest</span>
    </Button>
  )
}

export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
}
