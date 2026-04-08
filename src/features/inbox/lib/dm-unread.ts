import { supabase } from "@/integrations/supabase/client";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type DmUnreadConversationRow = {
  conversation_id: string;
  unread_count: number;
};

type DmUnreadOverviewResponse = {
  ok: boolean;
  total_unread?: number;
  conversations?: DmUnreadConversationRow[];
  message?: string;
};

export type DmUnreadOverview = {
  totalUnread: number;
  byConversation: Record<string, number>;
};

function parseUnreadOverview(raw: unknown): DmUnreadOverview {
  const payload = (raw || {}) as DmUnreadOverviewResponse;
  const rows = Array.isArray(payload.conversations) ? payload.conversations : [];
  const byConversation: Record<string, number> = {};

  for (const row of rows) {
    if (!row?.conversation_id) continue;
    byConversation[row.conversation_id] = Math.max(0, Number(row.unread_count) || 0);
  }

  const totalUnread = Math.max(0, Number(payload.total_unread) || 0);

  return { totalUnread, byConversation };
}

function getRpcClient(): RpcClient {
  return supabase as unknown as RpcClient;
}

export async function fetchDmUnreadOverview(): Promise<DmUnreadOverview> {
  const rpc = getRpcClient();
  const { data, error } = await rpc.rpc("get_dm_unread_overview");
  if (error) {
    throw new Error(error.message || "DM unread overview fetch failed.");
  }

  const payload = (data || {}) as DmUnreadOverviewResponse;
  if (payload.ok === false) {
    throw new Error(payload.message || "DM unread overview returned unsuccessful response.");
  }

  return parseUnreadOverview(payload);
}

export async function markDmConversationRead(conversationId: string): Promise<void> {
  const rpc = getRpcClient();
  const { data, error } = await rpc.rpc("mark_dm_conversation_read", {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw new Error(error.message || "Conversation read state update failed.");
  }

  const payload = (data || {}) as { ok?: boolean; message?: string };
  if (payload.ok === false) {
    throw new Error(payload.message || "Conversation read state update returned unsuccessful response.");
  }
}
