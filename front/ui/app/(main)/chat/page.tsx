"use client";

import { useState } from "react";
import {
  PaperPlaneTilt,
  CircleNotch,
  Robot,
  User,
} from "@phosphor-icons/react";
import { useQuerySearch, useBoxes, useAskBox } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  meta?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [boxId, setBoxId] = useState<string>("all");
  const querySearch = useQuerySearch();
  const askBox = useAskBox();
  const { data: boxes } = useBoxes();

  const suggestions = [
    "What are the main topics?",
    "Summarize this document",
    "List all dates mentioned",
  ];

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      id: Date.now().toString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let assistantMessage: ChatMessage;
      if (boxId === "all") {
        const response = await querySearch.mutateAsync({
          query: input,
          topK: 5,
        });

        const content =
          response.results.length > 0
            ? response.results
                .map(
                  (r) =>
                    `\n\n**Document: ${r.document.originalName}**\n${r.content}`,
                )
                .join("")
            : "No relevant results found.";
        assistantMessage = {
          role: "assistant",
          content,
          id: (Date.now() + 1).toString(),
        };
      } else {
        const response = await askBox.mutateAsync({
          boxId,
          query: input,
          topK: 5,
        });
        assistantMessage = {
          role: "assistant",
          content: response.answer,
          id: (Date.now() + 1).toString(),
          meta:
            response.sources.length > 0
              ? `${response.sources.map((s, i) => `[${i + 1}] ${s.documentName}`).join(" · ")} — ${response.model}`
              : response.model,
        };
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        id: (Date.now() + 1).toString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <h1 className="text-3xl">Chat</h1>
          <p className="text-muted-foreground">
            Ask questions about your documents
          </p>
        </div>
        <div className="space-y-1 sm:ml-auto sm:w-64">
          <Label>Box</Label>
          <Select
            value={boxId}
            onValueChange={(v) => {
              setBoxId(v);
              setMessages([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All documents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All documents (search)</SelectItem>
              {(boxes ?? []).map((box) => (
                <SelectItem key={box.id} value={box.id}>
                  {box.name} (answered by {box.answerModel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="flex flex-col h-[calc(100vh-200px)] max-h-[800px] overflow-hidden">
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent>
                {messages.length === 0 && !isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Robot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Start a conversation by asking a question</p>
                    <p className="text-xs mt-2">
                      Try: &quot;What are the main topics?&quot; or
                      &quot;Summarize this document&quot;
                    </p>
                  </div>
                ) : (
                  <MessageGroup>
                    {messages.map((message) => (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={message.role === "user"}
                      >
                        <Message
                          align={message.role === "user" ? "end" : "start"}
                        >
                          <MessageAvatar>
                            <Avatar className="size-8">
                              <AvatarFallback>
                                {message.role === "user" ? (
                                  <User className="size-4" />
                                ) : (
                                  <Robot className="size-4" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                          </MessageAvatar>
                          <MessageContent>
                            <Bubble
                              variant={
                                message.role === "user"
                                  ? "default"
                                  : "secondary"
                              }
                              align={message.role === "user" ? "end" : "start"}
                            >
                              <BubbleContent>{message.content}</BubbleContent>
                            </Bubble>
                            {message.meta && (
                              <MessageFooter>{message.meta}</MessageFooter>
                            )}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}
                    {isLoading && (
                      <MessageScrollerItem
                        messageId="typing"
                        scrollAnchor={false}
                      >
                        <Message align="start">
                          <MessageAvatar>
                            <Avatar className="size-8">
                              <AvatarFallback>
                                <CircleNotch className="size-4 animate-spin" />
                              </AvatarFallback>
                            </Avatar>
                          </MessageAvatar>
                          <MessageContent>
                            <Bubble variant="secondary" align="start">
                              <BubbleContent>Thinking…</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )}
                  </MessageGroup>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <div className="p-4 border-t space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button type="submit" disabled={!input.trim() || isLoading}>
              {isLoading ? (
                <CircleNotch className="w-4 h-4 animate-spin" />
              ) : (
                <PaperPlaneTilt className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
