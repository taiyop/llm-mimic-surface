import {
  createEchoBackend,
  createExternalApiServer,
  openAIProtocol,
  anthropicProtocol,
  geminiProtocol
} from "../../src/index.js";

const backend = createEchoBackend();

const server = createExternalApiServer({
  backend,
  protocols: [openAIProtocol(), anthropicProtocol(), geminiProtocol()],
  auth: false
});

const { host, port } = await server.listen({ host: "127.0.0.1", port: 8080 });
console.log(`Echo server at http://${host}:${port}`);
console.log("OpenAI:  POST /v1/chat/completions");
console.log("Anthropic: POST /v1/messages");
console.log("Gemini: POST /v1beta/models/{model}:generateContent");
