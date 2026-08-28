import type { ContentPart, Message } from "../boundary/content.js";

export function extractText(content: ContentPart[] | string | undefined): string {
  if (typeof content === "string") {
    return content;
  }
  if (!content) {
    return "";
  }
  return content
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }
      if (part.type === "reasoning") {
        return part.text;
      }
      return "";
    })
    .join("");
}

export function lastUserText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "user") {
      const text = extractText(message.content);
      if (text.trim()) {
        return text;
      }
    }
  }
  return extractText(messages.at(-1)?.content);
}

export function joinNonEmpty(parts: Array<string | undefined>, separator = "\n\n"): string | undefined {
  const filtered = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join(separator) : undefined;
}
