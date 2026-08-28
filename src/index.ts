export { llmMimicSurfacePlugin, RouteCollisionError } from "./transport/http/plugin.js";
export type { LLMMimicSurfacePluginOptions } from "./transport/http/plugin.js";

export { openAIProtocol } from "./protocol/openai/index.js";
export { xaiProtocol } from "./protocol/xai/index.js";
export { anthropicProtocol } from "./protocol/anthropic/index.js";
export { geminiProtocol } from "./protocol/gemini/index.js";
export { createSimpleProtocol } from "./protocol/simple.js";
export { createProtocolAdapter, withProtocolOptions } from "./protocol/create.js";
export type {
  ProtocolAdapter,
  ProtocolOptions,
  ProtocolCodec,
  ProtocolHandler,
  ProtocolRequest,
  ProtocolReply,
  RouteRegistrar,
  RouteSpec,
  DecodeMeta,
  StreamEncodeState,
  StreamWriter
} from "./protocol/types.js";

export { createEchoBackend, MockBackend } from "./backend/mock.js";
export type { MockBackendOptions } from "./backend/mock.js";
export type { ExternalApiBackend, InvocationContext } from "./backend/types.js";
export { resolveCapabilities, enforceCapabilities } from "./backend/capabilities.js";

export { BackendError } from "./boundary/errors.js";
export type { BackendErrorCode, EncodedError } from "./boundary/errors.js";
export type {
  InvocationRequest,
  GenerationParams,
  NativePayload,
  LossyConversionPolicy
} from "./boundary/request.js";
export type { InvocationResponse, ModelInfo, Usage } from "./boundary/response.js";
export type { InvocationEvent, EncodedStreamEvent } from "./boundary/events.js";
export type {
  BackendCapabilities,
  ProtocolCapabilities
} from "./boundary/capabilities.js";
export type {
  ContentPart,
  Message,
  ToolDefinition,
  FunctionTool,
  ProviderTool,
  UnknownTool,
  ToolChoice,
  ResponseFormat,
  Citation,
  TextPart,
  ImagePart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  ReasoningPart,
  UnknownPart
} from "./boundary/content.js";

export { serializeMessagesToPrompt } from "./util/serialize-messages.js";
export type { SerializeMessagesOptions } from "./util/serialize-messages.js";

export type { HttpTransportHooks, ServerHooks } from "./hooks.js";
