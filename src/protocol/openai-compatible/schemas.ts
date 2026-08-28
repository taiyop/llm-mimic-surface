import { z } from "zod";

export const unknownRecord = z.record(z.unknown());

export const chatMessageSchema = z
  .object({
    role: z.string(),
    content: z.unknown().optional(),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
    tool_calls: z.array(z.unknown()).optional()
  })
  .passthrough();

export const chatCompletionsRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(chatMessageSchema),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    max_tokens: z.number().optional(),
    max_completion_tokens: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    stream: z.boolean().optional(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
    response_format: z.unknown().optional(),
    n: z.number().optional(),
    presence_penalty: z.number().optional(),
    frequency_penalty: z.number().optional(),
    seed: z.number().optional(),
    user: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    reasoning_effort: z.string().optional(),
    reasoning: z.unknown().optional()
  })
  .passthrough();

export const responsesRequestSchema = z
  .object({
    model: z.string(),
    input: z.unknown(),
    instructions: z.string().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    max_output_tokens: z.number().optional(),
    stream: z.boolean().optional(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
    text: z.unknown().optional(),
    metadata: z.record(z.unknown()).optional(),
    previous_response_id: z.string().optional(),
    store: z.boolean().optional(),
    include: z.array(z.string()).optional(),
    reasoning: z.unknown().optional(),
    truncation: z.string().optional()
  })
  .passthrough();

export type ChatCompletionsRequest = z.infer<typeof chatCompletionsRequestSchema>;
export type ResponsesRequest = z.infer<typeof responsesRequestSchema>;

export const CHAT_KNOWN_KEYS = [
  "model",
  "messages",
  "temperature",
  "top_p",
  "max_tokens",
  "max_completion_tokens",
  "stop",
  "stream",
  "tools",
  "tool_choice",
  "response_format",
  "n",
  "presence_penalty",
  "frequency_penalty",
  "seed",
  "user",
  "metadata",
  "reasoning_effort",
  "reasoning"
] as const;

export const RESPONSES_KNOWN_KEYS = [
  "model",
  "input",
  "instructions",
  "temperature",
  "top_p",
  "max_output_tokens",
  "stream",
  "tools",
  "tool_choice",
  "text",
  "metadata",
  "previous_response_id",
  "store",
  "include",
  "reasoning",
  "truncation"
] as const;
