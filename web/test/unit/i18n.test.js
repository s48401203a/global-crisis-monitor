import { describe, expect, it } from "vite-plus/test";
import { ZH, EN, UI_I18N } from "../../src/i18n/index.js";

const keys = (o) => Object.keys(o).sort();

describe("i18n parity", () => {
  it("ZH and EN dictionaries have identical key sets (top level and sub dicts)", () => {
    expect(keys(ZH)).toEqual(keys(EN));
    for (const sub of [
      "types",
      "cats",
      "sources",
      "units",
      "status",
      "pipeline",
      "healthWarn",
      "theaterLevel",
    ]) {
      expect(keys(ZH[sub])).toEqual(keys(EN[sub]));
    }
  });
  it("UI_I18N zh/en have identical keys", () => {
    expect(keys(UI_I18N.zh)).toEqual(keys(UI_I18N.en));
  });
});
