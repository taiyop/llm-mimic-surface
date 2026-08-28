import {
  BackendError,
  serializeMessagesToPrompt,
  type BackendCapabilities,
  type ExternalApiBackend,
  type InvocationContext,
  type InvocationEvent,
  type InvocationRequest,
  type InvocationResponse,
  type ModelInfo
} from "../../src/index.js";
import { createId } from "../../src/util/id.js";

export interface HeadlessAgentMapping {
  provider: string;
  model?: string;
  reasoningEffort?: string;
}

export interface HeadlessCoreLike {
  run(options: {
    agent: { provider: string; model?: string; reasoningEffort?: string };
    prompt: string;
    onProgress?: (event: { state?: string; partialOutput?: string; message?: string }) => void | Promise<void>;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<string>;
}

export interface HeadlessCoreBackendOptions {
  core: HeadlessCoreLike;
  defaultAgent?: string;
  models?: Record<string, HeadlessAgentMapping>;
  timeoutMs?: number;
}

const HEADLESS_CAPABILITIES: BackendCapabilities = {
  streaming: true,
  tools: false,
  providerTools: false,
  reasoning: true,
  structuredOutput: false,
  citations: false,
  input: {
    text: true,
    image: false,
    file: false
  }
};

export class HeadlessCoreBackend implements ExternalApiBackend {
  constructor(private readonly options: HeadlessCoreBackendOptions) {}

  capabilities(): BackendCapabilities {
    return HEADLESS_CAPABILITIES;
  }

  async listModels(_context: InvocationContext): Promise<ModelInfo[]> {
    const mapped = Object.keys(this.options.models ?? {}).map((id) => ({ id, ownedBy: "headless_core" }));
    if (mapped.length > 0) {
      return mapped;
    }
    return [
      { id: "codex/default", ownedBy: "headless_core" },
      { id: "claude/sonnet", ownedBy: "headless_core" },
      { id: "grok/default", ownedBy: "headless_core" }
    ];
  }

  async invoke(request: InvocationRequest, context: InvocationContext): Promise<InvocationResponse> {
    const output = await this.runAgent(request, context);
    return {
      id: createId("headless_"),
      model: request.model,
      message: {
        role: "assistant",
        content: [{ type: "text", text: output }]
      },
      finishReason: "stop"
    };
  }

  async *stream(request: InvocationRequest, context: InvocationContext): AsyncIterable<InvocationEvent> {
    const id = createId("headless_");
    yield { type: "response.start", id, model: request.model };

    const queue: string[] = [];
    let previous = "";
    let done = false;
    let failed: unknown;
    let wake: (() => void) | undefined;

    const notify = () => {
      wake?.();
      wake = undefined;
    };

    const run = this.runAgent(request, context, async (partial, state) => {
      if (!partial || state === "completed" || state === "failed") {
        return;
      }
      const delta = toDelta(partial, previous);
      previous = delta.nextAccumulated;
      if (delta.text) {
        queue.push(delta.text);
        notify();
      }
    })
      .catch((error: unknown) => {
        failed = error;
      })
      .finally(() => {
        done = true;
        notify();
      });

    while (!done || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        continue;
      }
      const text = queue.shift();
      if (text) {
        yield { type: "text.delta", delta: text };
      }
    }

    const finalOutput = await run;
    if (failed) {
      throw failed;
    }
    if (typeof finalOutput === "string") {
      if (!previous) {
        yield { type: "text.delta", delta: finalOutput };
      } else if (finalOutput.startsWith(previous) && finalOutput.length > previous.length) {
        yield { type: "text.delta", delta: finalOutput.slice(previous.length) };
      }
    }
    yield { type: "response.end", finishReason: "stop" };
  }

  private async runAgent(
    request: InvocationRequest,
    context: InvocationContext,
    onPartial?: (partial: string, state?: string) => void | Promise<void>
  ): Promise<string> {
    if (request.tools?.length) {
      throw new BackendError({
        code: "unsupported_feature",
        message: "headless_core backend does not support tools",
        param: "tools"
      });
    }
    const agent = resolveAgent(request.model, this.options);
    const prompt = buildPrompt(request);
    try {
      return await this.options.core.run({
        agent: {
          provider: agent.provider,
          model: agent.model,
          reasoningEffort: request.reasoning?.effort ?? agent.reasoningEffort
        },
        prompt,
        signal: context.signal,
        timeoutMs: this.options.timeoutMs,
        onProgress: async (event) => {
          if (event.partialOutput) {
            await onPartial?.(event.partialOutput, event.state);
          }
        }
      });
    } catch (error) {
      if (context.signal.aborted) {
        throw new BackendError({ code: "aborted", message: "headless_core run aborted", cause: error });
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new BackendError({
        code: "backend_unavailable",
        message,
        cause: error
      });
    }
  }
}

export function resolveAgent(model: string, options: HeadlessCoreBackendOptions): HeadlessAgentMapping {
  const mapped = options.models?.[model];
  if (mapped) {
    return mapped;
  }
  const slash = model.indexOf("/");
  if (slash > 0) {
    return {
      provider: model.slice(0, slash),
      model: model.slice(slash + 1)
    };
  }
  return {
    provider: options.defaultAgent ?? "codex",
    model
  };
}

export function buildPrompt(request: InvocationRequest): string {
  const serialized = serializeMessagesToPrompt(request.messages);
  if (request.instructions?.trim()) {
    return `[SYSTEM]\n${request.instructions.trim()}\n\n${serialized}`.trim();
  }
  return serialized;
}

/**
 * headless_core `onProgress.partialOutput` is a stdout/stderr *chunk* during
 * `running`, and the *full* accumulated output on `completed`/`failed`.
 * Treat prefix matches as cumulative; otherwise treat the value as a delta.
 * If the value shrinks, drop it to avoid duplicated stream text.
 */
export function toDelta(
  partialOutput: string,
  previous: string
): { text: string; nextAccumulated: string } {
  if (!partialOutput) {
    return { text: "", nextAccumulated: previous };
  }
  if (previous && partialOutput.startsWith(previous)) {
    return { text: partialOutput.slice(previous.length), nextAccumulated: partialOutput };
  }
  if (previous && previous.startsWith(partialOutput)) {
    return { text: "", nextAccumulated: previous };
  }
  return { text: partialOutput, nextAccumulated: previous + partialOutput };
}
