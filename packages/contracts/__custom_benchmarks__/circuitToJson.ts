import { writeFileSync, readFileSync } from "node:fs";

export type TCircuitInputs = Record<
  string,
  string | bigint | bigint[] | bigint[][] | string[] | bigint[][][] // 3‑D
>;

const TAG = "__bigint__:"; // unique prefix unlikely to conflict

/* ------------------------------------------------------------------ */
/*  JSON helpers                                                      */
/* ------------------------------------------------------------------ */

/** Replacer ─ runs during `JSON.stringify()` */
function toJson(_: string, value: unknown): unknown {
  return typeof value === "bigint" ? TAG + value : value;
}

/** Reviver ─ runs during `JSON.parse()` */
function fromJson(_: string, value: unknown): unknown {
  return typeof value === "string" && value.startsWith(TAG) ? BigInt(value.slice(TAG.length)) : value;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Serialise *one*   `TCircuitInputs`
 * …or an *array* of `TCircuitInputs`
 * and write it to disk (pretty-printed UTF-8 JSON).
 */
export function saveCircuitInputs(data: TCircuitInputs[], path = "circuit-inputs.json"): void {
  const json = JSON.stringify(data, toJson, 2);
  writeFileSync(path, json, "utf8");
}

/**
 * Read JSON from disk and deserialize.
 *
 * If the file contains a single object you’ll get **`TCircuitInputs`**.
 * If it contains an array   you’ll get **`TCircuitInputs[]`**.
 */
export function loadCircuitInputs(path = "circuit-inputs.json"): TCircuitInputs[] {
  const json = readFileSync(path, "utf8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return JSON.parse(json, fromJson);
}
