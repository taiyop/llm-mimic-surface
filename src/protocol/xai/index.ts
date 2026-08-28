import type { ProtocolAdapter, ProtocolOptions } from "../types.js";
import { createOpenAICompatibleProtocol } from "../openai-compatible/adapter.js";
import { withProtocolOptions } from "../create.js";
import { xaiDialect } from "./dialect.js";

export function xaiProtocol(options?: ProtocolOptions): ProtocolAdapter {
  return withProtocolOptions(createOpenAICompatibleProtocol(xaiDialect), options);
}

export { xaiDialect };
