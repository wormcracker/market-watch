"use client";
import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useQueryTab<T extends string>(
  tabs: T[],
  defaultTab: T,
  paramName = "tab",
): [T, (tab: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // keep latest searchParams in a ref (avoids stale closures)
  const paramsRef = useRef(searchParams);

  useEffect(() => {
    paramsRef.current = searchParams;
  }, [searchParams]);

  const raw = searchParams.get(paramName) as T | null;
  const tab: T = raw && tabs.includes(raw) ? raw : defaultTab;

  const setTab = useCallback(
    (newTab: T) => {
      const params = new URLSearchParams(paramsRef.current.toString());

      params.set(paramName, newTab);

      const qs = params.toString();
      router.replace(`${pathname}?${qs}`, { scroll: false });
    },
    [router, pathname, paramName],
  );

  return [tab, setTab];
}
