import Fastify from "fastify";
import { anthropicProtocol, createEchoBackend, geminiProtocol, llmMimicSurfacePlugin, openAIProtocol } from "../../src/index.js";

const backend = createEchoBackend();

const server = Fastify();
await server.register(llmMimicSurfacePlugin, {
  backend,
  protocols: [openAIProtocol(), anthropicProtocol(), geminiProtocol()]
});

await server.listen({ host: "127.0.0.1", port: 8080 });
console.log("Echo server at http://127.0.0.1:8080");
console.log("OpenAI:  POST /v1/chat/completions");
console.log("Anthropic: POST /v1/messages");
console.log("Gemini: POST /v1beta/models/{model}:generateContent");
