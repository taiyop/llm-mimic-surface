import type { ProtocolAdapter, ProtocolOptions } from "../types.js";
import { createOpenAICompatibleProtocol } from "../openai-compatible/adapter.js";
import { withProtocolOptions } from "../create.js";
import { openAIDialect } from "./dialect.js";

export function openAIProtocol(options?: ProtocolOptions): ProtocolAdapter {
  return withProtocolOptions(createOpenAICompatibleProtocol(openAIDialect), options);
}

export { openAIDialect };
