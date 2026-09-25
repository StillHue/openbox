import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Loader2, Send, Copy, ThumbsUp, ThumbsDown, Settings, Sparkles, X } from 'lucide-react';
import { useQuerySearch } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { QueryResult } from '@/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: QueryResult[];
  feedback?: 'positive' | 'negative';
}

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(searchParams.get('doc') || '');
  const [showSources, setShowSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryMutation = useQuerySearch();

  const initialDocId = searchParams.get('doc');

  useEffect(() => {
    if (initialDocId) {
      setSelectedDocId(initialDocId);
      setSearchParams({});
    }
  }, [initialDocId, setSearchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await queryMutation.mutateAsync({
        query,
        topK: 10,
        documentIds: selectedDocId ? [selectedDocId] : undefined,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Based on the search results, I found ${response.results.length} relevant passages. Here's what I found:\n\n${response.results.map((r, i) => `${i + 1}. **${r.document.originalName}** (${Math.round(r.similarity * 100)}% match)\n   > ${r.content.slice(0, 200)}...`).join('\n\n')}`,
        timestamp: new Date(),
        sources: response.results,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Chat with Documents</h1>
            <p className="text-muted-foreground">Ask questions about your document library</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDocId && (
            <Badge variant="outline" className="gap-1">
              <span className="w-2 h-2 bg-primary rounded-full" />
              Filtering to document
              <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => setSelectedDocId('')}>
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          <Button variant="outline" onClick={clearChat} disabled={messages.length === 0}>
            <Settings className="w-4 h-4 mr-2" />
            Clear Chat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-2">
                <div className="space-y-6 pb-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Sparkles className="w-16 h-16 mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                      <p className="text-center max-w-md">
                        Ask me anything about your documents. I'll search through your library and provide answers with citations.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {[
                          'What are the main topics in my documents?',
                          'Summarize the key findings',
                          'Find mentions of specific people or organizations',
                          'Compare documents on a topic',
                        ].map((suggestion, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="text-left w-64"
                            onClick={() => setInput(suggestion)}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-2xl px-4 py-3',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          )}
                        >
                          <div className="prose prose-sm max-w-none">
                            {message.role === 'assistant' ? (
                              <>
                                <div className="whitespace-pre-wrap">{message.content}</div>
                                {message.sources && message.sources.length > 0 && (
                                  <div className="mt-3">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs gap-1 px-2 py-1"
                                      onClick={() => setShowSources((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                                    >
                                      {showSources[message.id] ? 'Hide' : 'Show'} Sources ({message.sources.length})
                                    </Button>
                                    {showSources[message.id] && (
                                      <div className="mt-2 space-y-2 border-t pt-2">
                                        {message.sources.map((source) => (
                                          <div
                                            key={source.id}
                                            className="text-xs p-2 bg-background rounded border"
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="font-medium truncate max-w-[200px]">
                                                {source.document.originalName}
                                              </span>
                                              <Badge variant="outline" className="text-xs">
                                                {Math.round(source.similarity * 100)}%
                                              </Badge>
                                            </div>
                                            <p className="text-muted-foreground line-clamp-2">
                                              {source.content.slice(0, 300)}...
                                            </p>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="mt-1 text-xs h-6 px-2"
                                              onClick={() => copyToClipboard(source.content)}
                                            >
                                              <Copy className="w-3 h-3 mr-1" />
                                              Copy
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-2 text-xs text-muted-foreground/70">
                            <span>{message.timestamp.toLocaleTimeString()}</span>
                            {message.role === 'assistant' && (
                              <div className="flex gap-1">
                                <Button
                                  variant={message.feedback === 'positive' ? 'default' : 'ghost'}
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleFeedback(message.id, 'positive')}
                                  disabled={!!message.feedback}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant={message.feedback === 'negative' ? 'destructive' : 'ghost'}
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleFeedback(message.id, 'negative')}
                                  disabled={!!message.feedback}
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
            <CardHeader className="border-t pt-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Textarea
                  placeholder={selectedDocId ? 'Ask about this document...' : 'Ask a question...'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 min-h-[60px] max-h-[150px] resize-none"
                  disabled={isLoading}
                  rows={2}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="self-end"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </CardHeader>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search in specific document</label>
                <Input
                  placeholder="Document ID or leave empty for all"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Quick Actions</label>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setInput('Summarize the key points')}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Summarize
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setInput('What are the main topics?')}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Topics
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setInput('Find all people mentioned')}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    People
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setInput('Find all organizations mentioned')}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Organizations
                  </Button>
                </div>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium mb-2 block">Conversation Stats</label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Messages</span>
                    <span className="font-medium">{messages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User Messages</span>
                    <span className="font-medium">{messages.filter(m => m.role === 'user').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assistant Messages</span>
                    <span className="font-medium">{messages.filter(m => m.role === 'assistant').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">With Sources</span>
                    <span className="font-medium">{messages.filter(m => m.sources && m.sources.length > 0).length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}