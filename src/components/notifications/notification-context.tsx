"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type NotificationContextValue = {
  userId: string;
  unreadCount: number;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  value,
  children,
}: {
  value: NotificationContextValue;
  children: ReactNode;
}) {
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useOptionalNotificationContext() {
  return useContext(NotificationContext);
}
