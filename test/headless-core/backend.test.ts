import { describe, expect, it } from "vitest";
import { openAIProtocol } from "../../src/index.js";
import {
  HeadlessCoreBackend,
  buildPrompt,
  resolveAgent,
  toDelta,
  type HeadlessCoreLike
} from "../../examples/headless-core/backend.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";

function fakeCore(output = "Hello from agent", chunks = ["Hel", "lo from agent"]): HeadlessCoreLike {
  return {
    async run(options) {
      for (const chunk of chunks) {
        await options.onProgress?.({ state: "running", partialOutput: chunk });
      }
      await options.onProgress?.({ state: "completed", partialOutput: output });
      return output;
    }
  };
}

describe("HeadlessCoreBackend", () => {
  it("maps model ids and serializes prompts", () => {
    expect(resolveAgent("claude/opus", { core: fakeCore(), defaultAgent: "codex" })).toEqual({
      provider: "claude",
      model: "opus"
    });
    expect(
      resolveAgent("local-codex", {
        core: fakeCore(),
        models: { "local-codex": { provider: "codex", model: "default" } }
      })
    ).toEqual({ provider: "codex", model: "default" });
    expect(
      buildPrompt({
        model: "codex/default",
        messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        instructions: "You are ...",
        source: { protocol: "openai", endpoint: "chat.completions" }
      })
    ).toContain("[SYSTEM]");
  });

  it("computes deltas from mixed chunk and cumulative partialOutput", () => {
    const first = toDelta("Hel", "");
    expect(first.text).toBe("Hel");
    const second = toDelta("Hello", first.nextAccumulated);
    expect(second.text).toBe("lo");
    const shrink = toDelta("He", second.nextAccumulated);
    expect(shrink.text).toBe("");
    const chunk = toDelta("!", "Hello");
    expect(chunk.text).toBe("!");
    expect(chunk.nextAccumulated).toBe("Hello!");
  });

  it("exposes a text-only OpenAI endpoint", async () => {
    const backend = new HeadlessCoreBackend({ core: fakeCore("Hello from agent", ["Hello from agent"]) });
    await withInjectedServer([openAIProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: {
          model: "codex/default",
          messages: [{ role: "user", content: "Hello" }]
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().choices[0].message.content).toBe("Hello from agent");
    }, { backend });
  });

  it("streams progress chunks without duplicating the completed snapshot", async () => {
    const backend = new HeadlessCoreBackend({
      core: fakeCore("Hello from agent", ["Hel", "lo from agent"])
    });
    await withListeningServer([openAIProtocol()], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "codex/default",
          stream: true,
          messages: [{ role: "user", content: "Hello" }]
        })
      });
      const sse = await readSse(response);
      const deltas = [...sse.matchAll(/"content":"([^"]*)"/g)].map((match) => match[1]).join("");
      expect(deltas.replace(/\\n/g, "")).toContain("Hello from agent");
      expect(deltas.split("Hello from agent").length - 1).toBeLessThanOrEqual(1);
    }, { backend });
  });

  it("rejects tools because the backend cannot support them", async () => {
    const backend = new HeadlessCoreBackend({ core: fakeCore() });
    await withInjectedServer([openAIProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: {
          model: "codex/default",
          messages: [{ role: "user", content: "Hello" }],
          tools: [{ type: "function", function: { name: "x", parameters: { type: "object" } } }]
        }
      });
      expect(response.statusCode).toBe(400);
    }, { backend });
  });
});
