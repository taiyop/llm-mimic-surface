import { rm } from "node:fs/promises";
import { URL } from "node:url";

const dist = new URL("../dist/", import.meta.url);
await rm(dist, { recursive: true, force: true });
