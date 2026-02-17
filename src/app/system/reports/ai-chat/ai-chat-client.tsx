"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Sparkles, HelpCircle, Trash2, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { processAIQuery, getSuggestedQuestions, ConversationContext, ChatMessage, createInitialContext } from "@/lib/services/ai-service";
import { cn } from "@/lib/utils";
import { ChatSessionSidebar, ChatSession } from "@/components/ai-chat/ChatSessionSidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isDemo?: boolean;
  suggestions?: string[];
}

interface SessionData {
  id: string;
  title: string;
  messages: Message[];
  context: ConversationContext | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatStorage {
  sessions: SessionData[];
  activeSessionId: string | null;
}

const STORAGE_KEY = "ai-chat-sessions-system-v2";

// Generate a title from the first message
function generateTitle(content: string): string {
  const words = content.split(" ").slice(0, 5);
  let title = words.join(" ");
  if (content.split(" ").length > 5) {
    title += "...";
  }
  return title || "New Chat";
}

export function AIChatClient() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: ChatStorage = JSON.parse(saved);
        if (parsed.sessions && parsed.sessions.length > 0) {
          const loadedSessions: ChatSession[] = parsed.sessions.map(s => ({
            id: s.id,
            title: s.title,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          }));
          setSessions(loadedSessions);
          
          if (parsed.activeSessionId) {
            setActiveSessionId(parsed.activeSessionId);
            const activeSession = parsed.sessions.find(s => s.id === parsed.activeSessionId);
            if (activeSession) {
              setMessages(activeSession.messages.map(m => ({
                ...m,
                timestamp: new Date(m.timestamp),
              })));
              setConversationContext(activeSession.context);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load saved sessions:", e);
      }
    }
  }, []);

  // Save current session messages when they change
  useEffect(() => {
    if (activeSessionId && messages.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      let storageData: ChatStorage = { sessions: [], activeSessionId };
      
      try {
        const parsed = saved ? JSON.parse(saved) : { sessions: [] };
        storageData.sessions = parsed.sessions || [];
      } catch {
        storageData.sessions = [];
      }
      
      // Update only the active session's messages
      const existingIndex = storageData.sessions.findIndex(s => s.id === activeSessionId);
      const sessionData: SessionData = {
        id: activeSessionId,
        title: sessions.find(s => s.id === activeSessionId)?.title || "New Chat",
        messages: messages,
        context: conversationContext,
        createdAt: sessions.find(s => s.id === activeSessionId)?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      if (existingIndex >= 0) {
        storageData.sessions[existingIndex] = sessionData;
      } else {
        storageData.sessions.push(sessionData);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    }
  }, [messages, conversationContext, activeSessionId, sessions]);

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

  // Create new session
  const createNewSession = useCallback(async () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "New Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages([]);
    setConversationContext(await createInitialContext());
    inputRef.current?.focus();
  }, []);

  // Select session
  const selectSession = useCallback((sessionId: string) => {
    // First save current session before switching
    if (activeSessionId && messages.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      let storageData: ChatStorage = { sessions: [], activeSessionId: sessionId };
      
      try {
        const parsed = saved ? JSON.parse(saved) : { sessions: [] };
        storageData.sessions = parsed.sessions || [];
      } catch {
        storageData.sessions = [];
      }
      
      const existingIndex = storageData.sessions.findIndex(s => s.id === activeSessionId);
      const sessionData: SessionData = {
        id: activeSessionId,
        title: sessions.find(s => s.id === activeSessionId)?.title || "New Chat",
        messages: messages,
        context: conversationContext,
        createdAt: sessions.find(s => s.id === activeSessionId)?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      if (existingIndex >= 0) {
        storageData.sessions[existingIndex] = sessionData;
      } else {
        storageData.sessions.push(sessionData);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    }
    
    // Now switch to new session
    setActiveSessionId(sessionId);
    
    // Load session data from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: ChatStorage = JSON.parse(saved);
        const session = parsed.sessions?.find(s => s.id === sessionId);
        if (session) {
          setMessages(session.messages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })));
          setConversationContext(session.context);
        } else {
          // New session with no history
          setMessages([]);
          setConversationContext(null);
        }
      } catch (e) {
        console.error("Failed to load session:", e);
        setMessages([]);
        setConversationContext(null);
      }
    }
  }, [activeSessionId, messages, conversationContext, sessions]);

  // Rename session
  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, title: newTitle, updatedAt: new Date() }
        : s
    ));
  }, []);

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        selectSession(remaining[0].id);
      } else {
        setActiveSessionId(null);
        setMessages([]);
        setConversationContext(null);
      }
    }
  }, [activeSessionId, sessions, selectSession]);

  // Clear current chat
  const clearCurrentChat = useCallback(async () => {
    setMessages([]);
    setConversationContext(await createInitialContext());
    toast.success("Chat cleared");
  }, []);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    // Create session if none exists
    if (!activeSessionId) {
      await createNewSession();
    }

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
      // Build conversation history for context
      const chatHistory: ChatMessage[] = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }));
      
      // Call AI service with conversation context
      const response = await processAIQuery(text, {
        conversationHistory: chatHistory,
        currentContext: conversationContext || undefined
      });

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
        
        // Update conversation context from response
        if (response.updatedContext) {
          setConversationContext(response.updatedContext);
        }

        // Update session title if this is the first message
        if (messages.length === 0 && activeSessionId) {
          renameSession(activeSessionId, generateTitle(text));
        }
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
    <div className="flex h-[calc(100vh-12rem)] min-h-[500px]">
      {/* Sidebar Toggle (Mobile) */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-2 z-50 lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Session Sidebar */}
      <div className={cn(
        "transition-all duration-300",
        sidebarOpen ? "block" : "hidden lg:block"
      )}>
        <ChatSessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onCreateSession={createNewSession}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Welcome Card */}
        {messages.length === 0 && (
          <Card className="bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-violet-500/20 dark:border-violet-500/30 m-4 mb-0">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                    AI Chat Assistant
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ask me anything about staff availability, scheduling conflicts, coverage analysis,
                    or staffing patterns. I query your actual database to provide real insights!
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <HelpCircle className="h-4 w-4 text-violet-500" />
                    <span>Try one of the suggested questions below to get started</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat Messages */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-violet-500/10 m-4">
          <CardHeader className="border-b border-violet-500/10 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <span className="bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                  AI Assistant
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCurrentChat}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                {messages.some((m) => m.isDemo) && (
                  <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-600 dark:text-violet-400">
                    Demo Mode
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div className="p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center py-12">
                    <div className="space-y-3">
                      <div className="p-4 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 w-fit mx-auto">
                        <Bot className="h-10 w-10 text-violet-500" />
                      </div>
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
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}

                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 max-w-[85%] space-y-2 shadow-sm",
                          message.role === "user"
                            ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                            : "bg-white dark:bg-slate-800 border border-violet-500/10 text-foreground"
                        )}
                      >
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {message.content.split("\n").map((line, i) => {
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
                          <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                            Demo Response
                          </Badge>
                        )}

                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-violet-500/10">
                            <span className="text-xs text-muted-foreground w-full">
                              Suggested follow-ups:
                            </span>
                            {message.suggestions.map((suggestion, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/30"
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
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-md">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-violet-500/10 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                        <span className="text-sm text-muted-foreground">Querying database...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          {/* Input Area */}
          <div className="border-t border-violet-500/10 p-4 space-y-3 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
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
                      className="text-xs border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/30"
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
                placeholder="Ask about staff availability, coverage, conflicts, or staff members..."
                disabled={loading}
                className="flex-1 border-violet-500/20 focus:border-violet-500 focus:ring-violet-500/20"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || loading}
                size="icon"
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
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
    </div>
  );
}
