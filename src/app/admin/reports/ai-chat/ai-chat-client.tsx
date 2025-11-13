"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Sparkles, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { processAIQuery, getSuggestedQuestions } from "@/lib/services/ai-service";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isDemo?: boolean;
  suggestions?: string[];
}

export function AIChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load suggested questions on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      const questions = await getSuggestedQuestions();
      setSuggestedQuestions(questions);
    };
    loadSuggestions();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Call AI service
      const response = await processAIQuery(text);

      if (response.success && response.answer) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          timestamp: new Date(),
          isDemo: response.isDemo,
          suggestions: response.suggestions,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        toast.error(response.error || "Failed to get AI response");
      }
    } catch (error) {
      console.error("AI query error:", error);
      toast.error("An error occurred while processing your query");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (question: string) => {
    handleSendMessage(question);
  };

  return (
    <div className="space-y-4">
      {/* Welcome Card */}
      {messages.length === 0 && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">AI Chat Assistant</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask me anything about staff availability, scheduling conflicts, coverage analysis,
                  or staffing patterns. I can help you make informed decisions about your team's schedule.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <HelpCircle className="h-4 w-4" />
                  <span>Try one of the suggested questions below to get started</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Messages */}
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              Chat
            </CardTitle>
            {messages.some((m) => m.isDemo) && (
              <Badge variant="outline" className="text-xs">
                Demo Mode
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center py-12">
                  <div className="space-y-2">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground text-sm">
                      No messages yet. Start a conversation!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-lg px-4 py-3 max-w-[80%] space-y-2",
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      )}
                    >
                      <div className="prose prose-sm max-w-none">
                        {message.content.split("\n").map((line, i) => {
                          // Handle markdown-style formatting
                          if (line.startsWith("**") && line.endsWith("**")) {
                            return (
                              <p key={i} className="font-bold mb-1">
                                {line.slice(2, -2)}
                              </p>
                            );
                          }
                          if (line.startsWith("- ")) {
                            return (
                              <li key={i} className="ml-4 mb-1">
                                {line.slice(2)}
                              </li>
                            );
                          }
                          if (line.match(/^\d+\./)) {
                            return (
                              <li key={i} className="ml-4 mb-1 list-decimal">
                                {line.replace(/^\d+\.\s*/, "")}
                              </li>
                            );
                          }
                          if (line.startsWith("```")) {
                            return null;
                          }
                          if (line.trim() === "") {
                            return <br key={i} />;
                          }
                          return (
                            <p key={i} className="mb-1">
                              {line}
                            </p>
                          );
                        })}
                      </div>

                      {message.isDemo && (
                        <Badge variant="secondary" className="text-xs">
                          Demo Response
                        </Badge>
                      )}

                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-600 w-full">
                            Suggested follow-ups:
                          </span>
                          {message.suggestions.map((suggestion, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleSuggestionClick(suggestion)}
                              disabled={loading}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="rounded-lg px-4 py-3 bg-gray-100">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input Area */}
        <div className="border-t p-4 space-y-3">
          {/* Suggested Questions (only show when no messages) */}
          {messages.length === 0 && suggestedQuestions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Suggested questions:</span>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.slice(0, 4).map((question, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSuggestionClick(question)}
                    disabled={loading}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input Field */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about staff availability, coverage, conflicts..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || loading}
              size="icon"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
