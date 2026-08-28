import { z } from "zod";

export const anthropicMessagesRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(z.unknown()),
    max_tokens: z.number(),
    system: z.unknown().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    top_k: z.number().optional(),
    stop_sequences: z.array(z.string()).optional(),
    stream: z.boolean().optional(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
    metadata: z.record(z.unknown()).optional(),
    thinking: z.unknown().optional(),
    output_config: z.unknown().optional()
  })
  .passthrough();

export const ANTHROPIC_KNOWN_KEYS = [
  "model",
  "messages",
  "max_tokens",
  "system",
  "temperature",
  "top_p",
  "top_k",
  "stop_sequences",
  "stream",
  "tools",
  "tool_choice",
  "metadata",
  "thinking",
  "output_config"
] as const;
