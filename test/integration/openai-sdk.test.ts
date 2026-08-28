import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { openAIProtocol, xaiProtocol } from "../../src/index.js";
import { withListeningServer } from "../helpers/server.js";

describe("OpenAI SDK integration", () => {
  it("chat completions and responses against the OpenAI protocol", async () => {
    await withListeningServer([openAIProtocol()], async (baseUrl) => {
      const client = new OpenAI({ baseURL: `${baseUrl}/v1`, apiKey: "dummy" });
      const completion = await client.chat.completions.create({
        model: "echo",
        messages: [{ role: "user", content: "sdk-hello" }]
      });
      expect(completion.choices[0]?.message.content).toBe("echo: sdk-hello");

      const stream = await client.chat.completions.create({
        model: "echo",
        stream: true,
        messages: [{ role: "user", content: "sdk-hello" }]
      });
      let streamed = "";
      for await (const chunk of stream) {
        streamed += chunk.choices[0]?.delta.content ?? "";
      }
      expect(streamed).toContain("echo:");

      const response = await client.responses.create({
        model: "echo",
        input: "sdk-hello"
      });
      expect(response.output_text).toContain("echo: sdk-hello");
    });
  });

  it("can point the OpenAI SDK at an xAI-compatible localhost endpoint", async () => {
    await withListeningServer([xaiProtocol()], async (baseUrl) => {
      const client = new OpenAI({ baseURL: `${baseUrl}/v1`, apiKey: "dummy" });
      const completion = await client.chat.completions.create({
        model: "grok-4.6",
        messages: [{ role: "user", content: "xai-sdk" }]
      });
      expect(completion.choices[0]?.message.content).toBe("echo: xai-sdk");
    });
  });
});
