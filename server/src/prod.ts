/** Production entry: turns off dev-only commands and guest logins, then starts the server. */
process.env.NODE_ENV = "production";
await import("./index.ts");
export {};
