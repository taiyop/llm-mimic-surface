import { z } from "zod";

export const geminiGenerateContentSchema = z
  .object({
    contents: z.array(z.unknown()).optional(),
    systemInstruction: z.unknown().optional(),
    system_instruction: z.unknown().optional(),
    generationConfig: z.unknown().optional(),
    generation_config: z.unknown().optional(),
    tools: z.array(z.unknown()).optional(),
    toolConfig: z.unknown().optional(),
    tool_config: z.unknown().optional(),
    safetySettings: z.unknown().optional(),
    safety_settings: z.unknown().optional()
  })
  .passthrough();

export const GEMINI_KNOWN_KEYS = [
  "contents",
  "systemInstruction",
  "system_instruction",
  "generationConfig",
  "generation_config",
  "tools",
  "toolConfig",
  "tool_config",
  "safetySettings",
  "safety_settings"
] as const;
