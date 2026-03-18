"use client";

import { useState, memo } from "react";
import { MessageSquare } from "lucide-react";
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

export const MessagesPageClient = memo(function MessagesPageClient({
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
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-muted/30">
        {/* Mobile: Show either list or thread */}
        <div className="flex w-full lg:hidden">
          {mobileView === "list" || !conversationId ? (
            <div className="w-full bg-background">
              <ConversationList
                currentUserId={currentUserId}
                onNewConversation={() => setNewConversationOpen(true)}
              />
            </div>
          ) : (
            <div className="w-full bg-background">
              <MessageThread
                conversationId={conversationId}
                currentUserId={currentUserId}
                currentUserEmail={currentUserEmail}
                onBack={() => setMobileView("list")}
              />
            </div>
          )}
        </div>

        {/* Desktop: Show both sidebar and content */}
        <div className="hidden w-full lg:flex">
          {/* Sidebar - Conversation List */}
          <aside className="w-80 flex-shrink-0 overflow-hidden rounded-l-2xl bg-background shadow-sm">
            <ConversationList
              currentUserId={currentUserId}
              onNewConversation={() => setNewConversationOpen(true)}
            />
          </aside>

          {/* Main Content - Message Thread */}
          <main className="relative flex-1 overflow-hidden rounded-r-2xl bg-background shadow-sm">
            {conversationId ? (
              <MessageThread
                conversationId={conversationId}
                currentUserId={currentUserId}
                currentUserEmail={currentUserEmail}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/20">
                  <MessageSquare className="h-10 w-10 text-primary/60" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  Select a conversation
                </h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Choose a conversation from the list to start messaging, or create a new one
                </p>
              </div>
            )}
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
});
