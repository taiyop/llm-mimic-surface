export interface BackendCapabilities {
  streaming?: boolean;
  tools?: boolean;
  providerTools?: boolean;
  reasoning?: boolean;
  structuredOutput?: boolean;
  citations?: boolean;
  input?: {
    text?: boolean;
    image?: boolean;
    file?: boolean;
  };
}

export interface ProtocolCapabilities {
  streaming: boolean;
  tools: boolean;
  models?: boolean;
}

export const TEXT_ONLY_CAPABILITIES: BackendCapabilities = {
  streaming: false,
  tools: false,
  providerTools: false,
  reasoning: false,
  structuredOutput: false,
  citations: false,
  input: {
    text: true,
    image: false,
    file: false
  }
};

export const FULL_MOCK_CAPABILITIES: BackendCapabilities = {
  streaming: true,
  tools: true,
  providerTools: true,
  reasoning: true,
  structuredOutput: true,
  citations: true,
  input: {
    text: true,
    image: true,
    file: true
  }
};
