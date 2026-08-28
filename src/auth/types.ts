export interface AuthContext {
  headers: Record<string, string | string[] | undefined>;
  path: string;
  protocol?: string;
}

export type AuthConfig =
  | false
  | {
      type: "bearer";
      validate: (token: string, context: AuthContext) => boolean | Promise<boolean>;
    }
  | {
      type: "custom";
      authenticate: (context: AuthContext) => boolean | Promise<boolean>;
    };
