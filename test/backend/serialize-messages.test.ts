import { describe, expect, it } from "vitest";
import { serializeMessagesToPrompt, type Message } from "../../src/index.js";

describe("serializeMessagesToPrompt", () => {
  it("renders a deterministic conversation prompt", () => {
    const messages: Message[] = [
      { role: "system", content: [{ type: "text", text: "You are helpful." }] },
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi." }] },
      { role: "user", content: [{ type: "text", text: "Explain this." }] }
    ];
    expect(serializeMessagesToPrompt(messages)).toBe(
      `[SYSTEM]
You are helpful.

[USER]
Hello

[ASSISTANT]
Hi.

[USER]
Explain this.`
    );
  });
});
