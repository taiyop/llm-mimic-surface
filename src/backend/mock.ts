import { FULL_MOCK_CAPABILITIES, type BackendCapabilities } from "../boundary/capabilities.js";
import type { ContentPart, Message } from "../boundary/content.js";
import type { InvocationEvent } from "../boundary/events.js";
import type { InvocationRequest } from "../boundary/request.js";
import type { InvocationResponse, ModelInfo } from "../boundary/response.js";
import { createId } from "../util/id.js";
import { lastUserText } from "../util/text.js";
import type { ExternalApiBackend, InvocationContext } from "./types.js";

export interface MockBackendOptions {
  capabilities?: BackendCapabilities;
  models?: ModelInfo[];
  prefix?: string;
  delayMs?: number;
  invoke?: (
    request: InvocationRequest,
    context: InvocationContext
  ) => InvocationResponse | Promise<InvocationResponse>;
  stream?: (
    request: InvocationRequest,
    context: InvocationContext
  ) => AsyncIterable<InvocationEvent>;
}

export class MockBackend implements ExternalApiBackend {
  private readonly options: MockBackendOptions;

  constructor(options: MockBackendOptions = {}) {
    this.options = options;
  }

  capabilities(): BackendCapabilities {
    return this.options.capabilities ?? FULL_MOCK_CAPABILITIES;
  }

  async listModels(_context: InvocationContext): Promise<ModelInfo[]> {
    return (
      this.options.models ?? [
        {
          id: "echo",
          displayName: "Echo",
          ownedBy: "mock"
        }
      ]
    );
  }

  async invoke(request: InvocationRequest, context: InvocationContext): Promise<InvocationResponse> {
    await maybeDelay(this.options.delayMs, context.signal);
    if (this.options.invoke) {
      return this.options.invoke(request, context);
    }
    return echoResponse(request, this.options.prefix ?? "echo: ");
  }

  async *stream(request: InvocationRequest, context: InvocationContext): AsyncIterable<InvocationEvent> {
    if (this.options.stream) {
      yield* this.options.stream(request, context);
      return;
    }
    const response = await this.invoke(request, context);
    yield { type: "response.start", id: response.id, model: response.model };
    const text = textFromMessage(response.message);
    for (const chunk of chunkText(text)) {
      await maybeDelay(this.options.delayMs, context.signal);
      yield { type: "text.delta", delta: chunk };
    }
    if (response.usage) {
      yield {
        type: "usage",
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        usage: response.usage
      };
    }
    yield { type: "response.end", finishReason: response.finishReason ?? "stop" };
  }
}

export function createEchoBackend(options: MockBackendOptions = {}): MockBackend {
  return new MockBackend(options);
}

export function echoResponse(request: InvocationRequest, prefix = "echo: "): InvocationResponse {
  const text = `${prefix}${lastUserText(request.messages)}`;
  return {
    id: createId("echo_"),
    model: request.model,
    message: {
      role: "assistant",
      content: [{ type: "text", text }]
    },
    finishReason: "stop",
    usage: {
      inputTokens: Math.max(1, lastUserText(request.messages).length),
      outputTokens: text.length,
      totalTokens: Math.max(1, lastUserText(request.messages).length) + text.length
    }
  };
}

function textFromMessage(message: Message): string {
  return message.content
    .map((part: ContentPart) => (part.type === "text" ? part.text : ""))
    .join("");
}

function chunkText(text: string): string[] {
  if (!text) {
    return [""];
  }
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [text];
}

async function maybeDelay(delayMs: number | undefined, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw abortError();
  }
  if (!delayMs) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}
