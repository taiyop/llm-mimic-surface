import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { anthropicProtocol } from "../../src/index.js";
import { withListeningServer } from "../helpers/server.js";

describe("Anthropic SDK integration", () => {
  it("messages create against the local Anthropic protocol", async () => {
    await withListeningServer([anthropicProtocol()], async (baseUrl) => {
      const client = new Anthropic({ apiKey: "dummy", baseURL: baseUrl });
      const message = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 32,
        messages: [{ role: "user", content: "sdk-hello" }]
      });
      const text = message.content[0] && message.content[0].type === "text" ? message.content[0].text : "";
      expect(text).toBe("echo: sdk-hello");
    });
  });
});
