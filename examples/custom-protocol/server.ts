import Fastify from "fastify";
import { createEchoBackend, createSimpleProtocol, llmMimicSurfacePlugin } from "../../src/index.js";

const server = Fastify();
await server.register(llmMimicSurfacePlugin, {
  backend: createEchoBackend(),
  protocols: [
    createSimpleProtocol({
      path: "/api/generate"
    })
  ]
});

await server.listen({ host: "127.0.0.1", port: 8081 });
console.log("Custom protocol at http://127.0.0.1:8081/api/generate");
console.log(`curl -s http://127.0.0.1:8081/api/generate -H 'content-type: application/json' -d '{"model":"echo","prompt":"hello"}'`);
