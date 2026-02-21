"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export const Assistant = () => {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="relative grid h-dvh overflow-hidden grid-cols-[200px_1fr] gap-x-2 px-4 py-4">
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
        <ThreadList />
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
