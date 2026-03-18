"use client";

import { Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error" | "reconnecting";

interface ConnectionStatusProps {
  state: ConnectionState;
  onRetry?: () => void;
}

const statusConfig = {
  connecting: {
    icon: <RefreshCw className="animate-spin text-yellow-500" />,
    text: "Connecting...",
    color: "text-yellow-500",
    showRetry: false
  },
  connected: {
    icon: <Wifi className="text-green-500" />,
    text: "Live updates active",
    color: "text-green-500",
    showRetry: false
  },
  reconnecting: {
    icon: <RefreshCw className="animate-spin text-yellow-500" />,
    text: "Reconnecting...",
    color: "text-yellow-500",
    showRetry: false
  },
  disconnected: {
    icon: <WifiOff className="text-gray-500" />,
    text: "Updates paused",
    color: "text-gray-500",
    showRetry: true
  },
  error: {
    icon: <AlertCircle className="text-red-500" />,
    text: "Connection error",
    color: "text-red-500",
    showRetry: true
  }
};

export function ConnectionStatusIndicator({ state, onRetry }: ConnectionStatusProps) {
  const { icon, text, color, showRetry } = statusConfig[state];
  
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      {icon}
      <span className="text-sm">{text}</span>
      {showRetry && onRetry && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRetry}
          className="h-8 w-4"
        >
          <RefreshCw className="mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
