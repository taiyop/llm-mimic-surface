import type { ProtocolAdapter, ProtocolOptions, RouteRegistrar } from "./types.js";
import type { ExternalApiBackend } from "../backend/types.js";
import type { ProtocolCapabilities } from "../boundary/capabilities.js";

export interface CreateProtocolAdapterOptions {
  id: string;
  version?: string;
  capabilities?: ProtocolCapabilities;
  registerRoutes: (
    registrar: RouteRegistrar,
    backend: ExternalApiBackend,
    options?: ProtocolOptions
  ) => void;
}

export function createProtocolAdapter(options: CreateProtocolAdapterOptions): ProtocolAdapter {
  return {
    id: options.id,
    version: options.version ?? "0.1.0",
    capabilities() {
      return (
        options.capabilities ?? {
          streaming: true,
          tools: true,
          models: false
        }
      );
    },
    registerRoutes(registrar, backend, protocolOptions) {
      options.registerRoutes(registrar, backend, protocolOptions);
    }
  };
}

export function withProtocolOptions(adapter: ProtocolAdapter, options?: ProtocolOptions): ProtocolAdapter {
  if (!options) {
    return adapter;
  }
  return {
    id: adapter.id,
    version: adapter.version,
    capabilities: () => adapter.capabilities(),
    registerRoutes(registrar, backend, extra) {
      adapter.registerRoutes(registrar, backend, {
        ...extra,
        ...options,
        prefix: extra?.prefix ?? options.prefix,
        lossyConversion: extra?.lossyConversion ?? options.lossyConversion,
        hooks: extra?.hooks ?? options.hooks
      });
    }
  };
}
