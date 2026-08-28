import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, "")}`;
}

export function unixSeconds(date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}
