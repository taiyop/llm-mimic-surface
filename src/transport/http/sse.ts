import type { FastifyReply } from "fastify";
import type { EncodedStreamEvent, StreamWriter } from "../../protocol/types.js";

const DEFAULT_KEEP_ALIVE_MS = 15_000;

export async function createSseWriter(
  reply: FastifyReply,
  options?: { keepAliveMs?: number; headers?: Record<string, string> }
): Promise<StreamWriter> {
  reply.hijack();
  const raw = reply.raw;
  raw.statusCode = 200;
  raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  raw.setHeader("Cache-Control", "no-cache, no-transform");
  raw.setHeader("Connection", "keep-alive");
  raw.setHeader("X-Accel-Buffering", "no");
  for (const [name, value] of Object.entries(options?.headers ?? {})) {
    raw.setHeader(name, value);
  }
  raw.flushHeaders?.();

  const keepAliveMs = options?.keepAliveMs ?? DEFAULT_KEEP_ALIVE_MS;
  const keepAlive = setInterval(() => {
    if (!raw.writableEnded) {
      raw.write(`: keep-alive\n\n`);
    }
  }, keepAliveMs);
  keepAlive.unref?.();

  const write = async (chunk: string) => {
    if (raw.writableEnded) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      raw.write(chunk, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  return {
    async write(event: EncodedStreamEvent) {
      let payload = "";
      if (event.comment) {
        payload += `: ${event.comment}\n`;
      }
      if (event.id) {
        payload += `id: ${event.id}\n`;
      }
      if (event.event) {
        payload += `event: ${event.event}\n`;
      }
      for (const line of event.data.split("\n")) {
        payload += `data: ${line}\n`;
      }
      payload += "\n";
      await write(payload);
    },
    async writeComment(comment: string) {
      await write(`: ${comment}\n\n`);
    },
    async end() {
      clearInterval(keepAlive);
      if (!raw.writableEnded) {
        await new Promise<void>((resolve) => {
          raw.end(() => resolve());
        });
      }
    }
  };
}
