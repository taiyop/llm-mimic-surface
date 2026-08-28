import type { Citation } from "./content.js";
import type { Usage } from "./response.js";

export type InvocationEvent =
  | {
      type: "response.start";
      id: string;
      model?: string;
    }
  | {
      type: "text.delta";
      delta: string;
    }
  | {
      type: "reasoning.delta";
      delta: string;
    }
  | {
      type: "tool_call.start";
      id: string;
      name: string;
    }
  | {
      type: "tool_call.delta";
      id: string;
      delta: string;
    }
  | {
      type: "tool_call.end";
      id: string;
    }
  | {
      type: "citation";
      citation: Citation;
    }
  | {
      type: "usage";
      inputTokens?: number;
      outputTokens?: number;
      usage?: Usage;
    }
  | {
      type: "response.end";
      finishReason?: string;
    }
  | {
      type: "extension";
      protocol: string;
      data: unknown;
    };

export interface EncodedStreamEvent {
  event?: string;
  data: string;
  id?: string;
  comment?: string;
}

export function collectTextFromEvents(events: InvocationEvent[]): string {
  let text = "";
  for (const event of events) {
    if (event.type === "text.delta") {
      text += event.delta;
    }
  }
  return text;
}
