import type { ContentPart, Message } from "../boundary/content.js";
import { extractText } from "./text.js";

export interface SerializeMessagesOptions {
  includeUnknownParts?: boolean;
}

function roleLabel(role: Message["role"]): string {
  switch (role) {
    case "system":
      return "SYSTEM";
    case "developer":
      return "DEVELOPER";
    case "user":
      return "USER";
    case "assistant":
      return "ASSISTANT";
    case "tool":
      return "TOOL";
    default:
      return role.toUpperCase();
  }
}

function serializePart(part: ContentPart, options: SerializeMessagesOptions): string | undefined {
  switch (part.type) {
    case "text":
      return part.text;
    case "reasoning":
      return `[reasoning]\n${part.text}`;
    case "image":
      return `[image${part.mimeType ? ` ${part.mimeType}` : ""}${part.url ? ` ${part.url}` : ""}]`;
    case "file":
      return `[file${part.filename ? ` ${part.filename}` : ""}${part.mimeType ? ` ${part.mimeType}` : ""}]`;
    case "tool_call":
      return `[tool_call ${part.name}${part.id ? ` id=${part.id}` : ""}]\n${part.arguments ?? ""}`;
    case "tool_result":
      return `[tool_result${part.toolCallId ? ` id=${part.toolCallId}` : ""}]\n${
        typeof part.content === "string" ? part.content : extractText(part.content)
      }`;
    case "unknown":
      if (!options.includeUnknownParts) {
        return undefined;
      }
      return `[unknown ${part.kind ?? "part"}]`;
    default:
      return undefined;
  }
}

export function serializeMessagesToPrompt(
  messages: Message[],
  options: SerializeMessagesOptions = {}
): string {
  const blocks: string[] = [];
  for (const message of messages) {
    const body =
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) => serializePart(part, options))
            .filter((part): part is string => Boolean(part && part.length > 0))
            .join("\n");
    if (!body.trim()) {
      continue;
    }
    blocks.push(`[${roleLabel(message.role)}]\n${body.trim()}`);
  }
  return blocks.join("\n\n");
}
