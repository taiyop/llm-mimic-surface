export const XAI_CHAT_EXTRA = [
  "search_parameters",
  "deferred",
  "web_search_options",
  "logprobs",
  "top_logprobs",
  "stream_options",
  "max_completion_tokens"
] as const;

export const XAI_RESPONSES_EXTRA = [
  "include",
  "previous_response_id",
  "store",
  "background",
  "search_parameters"
] as const;

export function mapXaiChatExtensions(unknown: Record<string, unknown>): Record<string, unknown> | undefined {
  const xai: Record<string, unknown> = {};
  for (const key of XAI_CHAT_EXTRA) {
    if (unknown[key] !== undefined) {
      xai[key] = unknown[key];
    }
  }
  return Object.keys(xai).length > 0 ? { xai } : undefined;
}

export function mapXaiResponsesExtensions(unknown: Record<string, unknown>): Record<string, unknown> | undefined {
  const xai: Record<string, unknown> = {};
  for (const key of XAI_RESPONSES_EXTRA) {
    if (unknown[key] !== undefined) {
      xai[key] = unknown[key];
    }
  }
  return Object.keys(xai).length > 0 ? { xai } : undefined;
}
