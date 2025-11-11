"use client";

import { useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface DashboardLayoutProps {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role: {
      name: string;
    };
  };
  unreadCount?: number;
  unreadMessageCount?: number;
  children: React.ReactNode;
}

export function DashboardLayout({ user, unreadCount = 0, unreadMessageCount = 0, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header user={user} unreadCount={unreadCount} onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r bg-background lg:block">
          <div className="h-full overflow-y-auto p-4">
            <Sidebar userRole={user.role.name} unreadMessageCount={unreadMessageCount} />
          </div>
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0" aria-describedby={undefined}>
            <SheetHeader className="border-b p-4">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="h-full overflow-y-auto p-4">
              <Sidebar userRole={user.role.name} unreadMessageCount={unreadMessageCount} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
