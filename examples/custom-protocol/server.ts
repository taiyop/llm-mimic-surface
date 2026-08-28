import {
  createEchoBackend,
  createExternalApiServer,
  createSimpleProtocol
} from "../../src/index.js";

const server = createExternalApiServer({
  backend: createEchoBackend(),
  protocols: [
    createSimpleProtocol({
      path: "/api/generate"
    })
  ],
  auth: false
});

const { host, port } = await server.listen({ host: "127.0.0.1", port: 8081 });
console.log(`Custom protocol at http://${host}:${port}/api/generate`);
console.log(`curl -s http://${host}:${port}/api/generate -H 'content-type: application/json' -d '{"model":"echo","prompt":"hello"}'`);
