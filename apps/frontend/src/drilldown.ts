import { useCallback, useEffect, useState } from "react";

export type DrilldownParams = Record<string, string | number | boolean | null | undefined>;
export type DrilldownSchema = Record<string, readonly string[]>;

export function buildDrilldownSearch(params: DrilldownParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([left], [right]) => left.localeCompare(right))) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export function readDrilldown(search: string, schema: DrilldownSchema): Record<string, string> {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    Object.entries(schema).flatMap(([key, allowed]) => {
      const value = params.get(key);
      return value && allowed.includes(value) ? [[key, value]] : [];
    })
  );
}

export function useDrilldownQuery(schema: DrilldownSchema) {
  const readCurrent = useCallback(() => readDrilldown(window.location.search, schema), [schema]);
  const [values, setValues] = useState<Record<string, string>>(readCurrent);

  useEffect(() => {
    const restore = () => setValues(readCurrent());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [readCurrent]);

  const update = useCallback(
    (params: DrilldownParams) => {
      const search = buildDrilldownSearch(params);
      window.history.pushState({}, "", `${window.location.pathname}${search}${window.location.hash}`);
      setValues(readDrilldown(search, schema));
    },
    [schema]
  );

  return [values, update] as const;
}
