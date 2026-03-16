import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import esmock from "esmock";

interface ConfigModule {
  loadConfig: () => import("../config.js").Config;
  resetConfigCache: () => void;
}

describe("config", () => {
  let loadConfig: ConfigModule["loadConfig"];
  let resetConfigCache: ConfigModule["resetConfigCache"];

  describe("valid config file", () => {
    beforeEach(async () => {
      const mod = (await esmock("../config.js", {
        fs: {
          readFileSync: () =>
            JSON.stringify({
              model: "claude-sonnet-4-6",
              maxTokens: 8192,
            }),
        },
      })) as ConfigModule;
      loadConfig = mod.loadConfig;
      resetConfigCache = mod.resetConfigCache;
    });

    it("parses config fields", () => {
      const config = loadConfig();
      assert.equal(config.model, "claude-sonnet-4-6");
      assert.equal(config.maxTokens, 8192);
      assert.equal(config.systemPrompt, undefined);
    });

    it("returns cached config on second call", () => {
      const first = loadConfig();
      const second = loadConfig();
      assert.equal(first, second);
    });

    it("resets cache", () => {
      const first = loadConfig();
      resetConfigCache();
      const second = loadConfig();
      assert.notEqual(first, second);
      assert.deepEqual(first, second);
    });
  });

  describe("missing config file (ENOENT)", () => {
    beforeEach(async () => {
      const mod = (await esmock("../config.js", {
        fs: {
          readFileSync: () => {
            const err = new Error("ENOENT") as NodeJS.ErrnoException;
            err.code = "ENOENT";
            throw err;
          },
        },
      })) as ConfigModule;
      loadConfig = mod.loadConfig;
      resetConfigCache = mod.resetConfigCache;
    });

    it("returns empty defaults", () => {
      const config = loadConfig();
      assert.deepEqual(config, {});
    });
  });

  describe("invalid JSON", () => {
    beforeEach(async () => {
      const mod = (await esmock("../config.js", {
        fs: {
          readFileSync: () => "not json {{{",
        },
      })) as ConfigModule;
      loadConfig = mod.loadConfig;
      resetConfigCache = mod.resetConfigCache;
    });

    it("throws on invalid JSON", () => {
      assert.throws(() => loadConfig(), SyntaxError);
    });
  });
});
