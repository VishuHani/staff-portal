"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { NewConversationDialog } from "./NewConversationDialog";

interface User {
  id: string;
  email: string;
  role: {
    name: string;
  } | null;
}

interface MessagesPageClientProps {
  conversationId?: string;
  currentUserId: string;
  currentUserEmail: string;
  users: User[];
}

export function MessagesPageClient({
  conversationId,
  currentUserId,
  currentUserEmail,
  users,
}: MessagesPageClientProps) {
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread">(
    conversationId ? "thread" : "list"
  );

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] gap-4">
        {/* Mobile: Show either list or thread */}
        <div className="flex w-full lg:hidden">
          {mobileView === "list" || !conversationId ? (
            <Card className="w-full">
              <CardContent className="h-[calc(100vh-4rem)] p-0">
                <ConversationList
                  currentUserId={currentUserId}
                  onNewConversation={() => setNewConversationOpen(true)}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full">
              <CardContent className="h-[calc(100vh-4rem)] p-0">
                <MessageThread
                  conversationId={conversationId}
                  currentUserId={currentUserId}
                  currentUserEmail={currentUserEmail}
                  onBack={() => setMobileView("list")}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Desktop: Show both sidebar and content */}
        <div className="hidden w-full lg:flex lg:gap-4">
          {/* Sidebar - Conversation List */}
          <aside className="w-80 flex-shrink-0">
            <Card className="h-full">
              <CardContent className="h-[calc(100vh-4rem)] p-0">
                <ConversationList
                  currentUserId={currentUserId}
                  onNewConversation={() => setNewConversationOpen(true)}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content - Message Thread */}
          <main className="flex-1">
            <Card className="h-full">
              <CardContent className="h-[calc(100vh-4rem)] p-0">
                {conversationId ? (
                  <MessageThread
                    conversationId={conversationId}
                    currentUserId={currentUserId}
                    currentUserEmail={currentUserEmail}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                    <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-semibold">
                      Select a conversation
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Choose a conversation from the list to start messaging
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        users={users}
        currentUserId={currentUserId}
      />
    </>
  );
}
