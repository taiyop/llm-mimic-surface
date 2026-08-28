import { enforceCapabilities, resolveCapabilities } from "../backend/capabilities.js";
import type { ExternalApiBackend, InvocationContext } from "../backend/types.js";
import { BackendError, toBackendError } from "../boundary/errors.js";
import type { EncodedStreamEvent, InvocationEvent } from "../boundary/events.js";
import type { InvocationRequest, LossyConversionPolicy } from "../boundary/request.js";
import type { InvocationResponse } from "../boundary/response.js";
import { createId, unixSeconds } from "../util/id.js";
import type { ProtocolReply, StreamEncodeState } from "./types.js";
import { createStreamState } from "./types.js";
import type { HttpTransportHooks } from "../hooks.js";
import { runHook } from "../hooks.js";

export interface DispatchOptions {
  backend: ExternalApiBackend;
  request: InvocationRequest;
  context: InvocationContext;
  stream: boolean;
  reply: ProtocolReply;
  policy: LossyConversionPolicy;
  encodeResponse: (response: InvocationResponse, request: InvocationRequest) => unknown;
  encodeEvent: (
    event: InvocationEvent,
    state: StreamEncodeState
  ) => EncodedStreamEvent | EncodedStreamEvent[] | null;
  trailer?: EncodedStreamEvent[];
  hooks?: HttpTransportHooks;
  protocol: string;
  path: string;
  method: string;
}

export async function dispatchInvocation(options: DispatchOptions): Promise<void> {
  const capabilities = resolveCapabilities(options.backend);
  enforceCapabilities(options.request, capabilities, options.policy);

  if (!options.stream) {
    const response = await options.backend.invoke(options.request, options.context);
    await options.reply.send(options.encodeResponse(response, options.request));
    return;
  }

  const writer = await options.reply.sse();
  const state = createStreamState(createId("resp_"), options.request.model, unixSeconds());
  try {
    const events = options.backend.stream
      ? options.backend.stream(options.request, options.context)
      : synthesizeStream(options.backend, options.request, options.context);

    for await (const event of events) {
      if (options.context.signal.aborted) {
        throw new BackendError({ code: "aborted", message: "Request was aborted" });
      }
      await runHook(options.hooks?.onStreamEvent, {
        requestId: options.context.requestId,
        protocol: options.protocol,
        method: options.method,
        path: options.path,
        remoteAddress: options.context.remoteAddress,
        eventType: event.type
      });
      const encoded = options.encodeEvent(event, state);
      if (!encoded) {
        continue;
      }
      const list = Array.isArray(encoded) ? encoded : [encoded];
      for (const item of list) {
        await writer.write(item);
      }
    }
    for (const trailer of options.trailer ?? []) {
      await writer.write(trailer);
    }
    await writer.end();
  } catch (error) {
    await writer.end();
    throw toBackendError(error);
  }
}

async function* synthesizeStream(
  backend: ExternalApiBackend,
  request: InvocationRequest,
  context: InvocationContext
): AsyncIterable<InvocationEvent> {
  const response = await backend.invoke(request, context);
  yield { type: "response.start", id: response.id, model: response.model };
  for (const part of response.message.content) {
    if (part.type === "text" && part.text) {
      yield { type: "text.delta", delta: part.text };
    } else if (part.type === "reasoning" && part.text) {
      yield { type: "reasoning.delta", delta: part.text };
    } else if (part.type === "tool_call") {
      yield { type: "tool_call.start", id: part.id ?? createId("call_"), name: part.name };
      if (part.arguments) {
        yield { type: "tool_call.delta", id: part.id ?? "", delta: part.arguments };
      }
      yield { type: "tool_call.end", id: part.id ?? "" };
    }
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
