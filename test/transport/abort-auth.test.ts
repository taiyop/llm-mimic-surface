import { describe, expect, it } from "vitest";
import { MockBackend, openAIProtocol } from "../../src/index.js";
import { withInjectedServer, withListeningServer } from "../helpers/server.js";

describe("transport", () => {
  it("coexists with application routes on the host server", async () => {
    await withInjectedServer(
      [openAIProtocol()],
      async (server) => {
        const status = await server.inject({ method: "GET", url: "/api/status" });
        expect(status.statusCode).toBe(200);
        expect(status.json()).toEqual({ ok: true });

        const completion = await server.inject({
          method: "POST",
          url: "/v1/chat/completions",
          payload: { model: "echo", messages: [{ role: "user", content: "hi" }] }
        });
        expect(completion.statusCode).toBe(200);
      },
      {
        configureHost(app) {
          app.get("/api/status", async () => ({ ok: true }));
        }
      }
    );
  });

  it("reports backend stream events through transport hooks", async () => {
    const eventTypes: string[] = [];
    await withListeningServer(
      [openAIProtocol()],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "echo",
            messages: [{ role: "user", content: "hi" }],
            stream: true
          })
        });
        expect(response.status).toBe(200);
        await response.text();
      },
      {
        hooks: {
          onStreamEvent(info) {
            eventTypes.push(info.eventType);
          }
        }
      }
    );
    expect(eventTypes).toContain("text.delta");
    expect(eventTypes).toContain("response.end");
  });

  it("aborts the backend when the client disconnects", async () => {
    let aborted = false;
    const backend = new MockBackend({
      invoke: async (_request, context) => {
        await new Promise<void>((resolve, reject) => {
          if (context.signal.aborted) {
            aborted = true;
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            return;
          }
          const timeout = setTimeout(resolve, 1_500);
          context.signal.addEventListener(
            "abort",
            () => {
              aborted = true;
              clearTimeout(timeout);
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            },
            { once: true }
          );
        });
        return {
          id: "x",
          model: "echo",
          message: { role: "assistant", content: [{ type: "text", text: "late" }] }
        };
      }
    });

    await withListeningServer([openAIProtocol()], async (baseUrl) => {
      const controller = new AbortController();
      const pending = fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "echo", messages: [{ role: "user", content: "hi" }] }),
        signal: controller.signal
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();
      await pending.catch(() => undefined);
      const deadline = Date.now() + 1000;
      while (!aborted && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(aborted).toBe(true);
    }, { backend });
  });

  it("lets the host reject missing bearer tokens before surface routes", async () => {
    await withInjectedServer(
      [openAIProtocol()],
      async (server) => {
        const response = await server.inject({
          method: "POST",
          url: "/v1/chat/completions",
          payload: { model: "echo", messages: [{ role: "user", content: "hi" }] }
        });
        expect(response.statusCode).toBe(401);
      },
      {
        configureHost(app) {
          app.addHook("onRequest", async (request, reply) => {
            if (request.headers.authorization !== "Bearer secret") {
              await reply.status(401).send({ error: "unauthorized" });
            }
          });
        }
      }
    );
  });

  it("runs surface routes after host authentication succeeds", async () => {
    await withInjectedServer(
      [openAIProtocol()],
      async (server) => {
        const response = await server.inject({
          method: "POST",
          url: "/v1/chat/completions",
          headers: { authorization: "Bearer secret" },
          payload: { model: "echo", messages: [{ role: "user", content: "hi" }] }
        });
        expect(response.statusCode).toBe(200);
      },
      {
        configureHost(app) {
          app.addHook("onRequest", async (request, reply) => {
            if (request.headers.authorization !== "Bearer secret") {
              await reply.status(401).send({ error: "unauthorized" });
            }
          });
        }
      }
    );
  });
});
