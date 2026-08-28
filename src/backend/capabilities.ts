import type { BackendCapabilities } from "../boundary/capabilities.js";
import { TEXT_ONLY_CAPABILITIES } from "../boundary/capabilities.js";
import { hasContentType, type Message } from "../boundary/content.js";
import { BackendError } from "../boundary/errors.js";
import type { InvocationRequest, LossyConversionPolicy } from "../boundary/request.js";
import type { ExternalApiBackend } from "./types.js";

export function resolveCapabilities(backend: ExternalApiBackend): BackendCapabilities {
  const declared = backend.capabilities?.() ?? {};
  return {
    streaming: declared.streaming ?? typeof backend.stream === "function",
    tools: declared.tools ?? false,
    providerTools: declared.providerTools ?? declared.tools ?? false,
    reasoning: declared.reasoning ?? false,
    structuredOutput: declared.structuredOutput ?? false,
    citations: declared.citations ?? false,
    input: {
      text: declared.input?.text ?? TEXT_ONLY_CAPABILITIES.input?.text ?? true,
      image: declared.input?.image ?? false,
      file: declared.input?.file ?? false
    }
  };
}

export function enforceCapabilities(
  request: InvocationRequest,
  capabilities: BackendCapabilities,
  policy: LossyConversionPolicy = "error"
): void {
  const streamRequested = request.stream === true;
  if (streamRequested && !capabilities.streaming) {
    throw new BackendError({
      code: "unsupported_feature",
      message: "Backend does not support streaming",
      param: "stream"
    });
  }

  const functionTools = request.tools?.filter((tool) => tool.type === "function") ?? [];
  const providerTools = request.tools?.filter((tool) => tool.type === "provider") ?? [];
  const unknownTools = request.tools?.filter((tool) => tool.type === "unknown") ?? [];

  if (functionTools.length > 0 && !capabilities.tools) {
    rejectOrPreserve(policy, "tools", "Backend does not support tools");
  }
  if ((providerTools.length > 0 || unknownTools.length > 0) && !capabilities.providerTools && !capabilities.tools) {
    rejectOrPreserve(policy, "tools", "Backend does not support provider or unknown tools");
  }

  if (request.toolChoice && request.toolChoice.type !== "auto" && request.toolChoice.type !== "none" && !capabilities.tools) {
    rejectOrPreserve(policy, "tool_choice", "Backend does not support tool choice");
  }

  if (request.responseFormat && request.responseFormat.type !== "text" && !capabilities.structuredOutput) {
    rejectOrPreserve(policy, "response_format", "Backend does not support structured output");
  }

  if (request.reasoning && !capabilities.reasoning) {
    rejectOrPreserve(policy, "reasoning", "Backend does not support reasoning");
  }

  if (hasParts(request.messages, "image") && !capabilities.input?.image) {
    rejectOrPreserve(policy, "messages", "Backend does not support image input");
  }
  if (hasParts(request.messages, "file") && !capabilities.input?.file) {
    rejectOrPreserve(policy, "messages", "Backend does not support file input");
  }
}

function hasParts(messages: Message[], type: "image" | "file"): boolean {
  return hasContentType(messages, type);
}

function rejectOrPreserve(policy: LossyConversionPolicy, param: string, message: string): void {
  if (policy === "best-effort") {
    return;
  }
  throw new BackendError({
    code: "unsupported_feature",
    message,
    param
  });
}
