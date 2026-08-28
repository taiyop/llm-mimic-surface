import type { ModelInfo } from "../../boundary/response.js";
import { unixSeconds } from "../../util/id.js";
import type { OpenAICompatibleDialect } from "./dialect.js";

export function encodeModelsList(models: ModelInfo[], dialect: OpenAICompatibleDialect): Record<string, unknown> {
  return {
    object: "list",
    data: models.map((model) => ({
      id: model.id,
      object: "model",
      created: model.created ?? unixSeconds(),
      owned_by: model.ownedBy ?? dialect.ownedBy,
      ...(model.displayName ? { display_name: model.displayName } : {})
    }))
  };
}
