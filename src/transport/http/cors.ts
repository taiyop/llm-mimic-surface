import type { FastifyReply, FastifyRequest } from "fastify";

export type CorsConfig = boolean | {
  origin?: string | string[] | true;
  methods?: string[];
  headers?: string[];
};

export function applyCors(request: FastifyRequest, reply: FastifyReply, cors: CorsConfig | undefined): void {
  if (!cors) {
    return;
  }
  const originHeader = request.headers.origin;
  const allowed =
    cors === true
      ? originHeader ?? "*"
      : cors.origin === true
        ? originHeader ?? "*"
        : Array.isArray(cors.origin)
          ? originHeader && cors.origin.includes(originHeader)
            ? originHeader
            : cors.origin[0]
          : cors.origin ?? originHeader ?? "*";
  if (allowed) {
    reply.header("Access-Control-Allow-Origin", allowed);
  }
  reply.header("Vary", "Origin");
  reply.header(
    "Access-Control-Allow-Methods",
    (cors === true ? undefined : cors.methods)?.join(",") ?? "GET,POST,DELETE,OPTIONS"
  );
  reply.header(
    "Access-Control-Allow-Headers",
    (cors === true ? undefined : cors.headers)?.join(",") ??
      "Authorization,Content-Type,x-api-key,x-goog-api-key,anthropic-version,openai-beta"
  );
}

export function isPreflight(request: FastifyRequest): boolean {
  return request.method === "OPTIONS";
}
