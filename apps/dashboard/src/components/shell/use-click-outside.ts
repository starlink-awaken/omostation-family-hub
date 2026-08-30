"use client";

import { useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement>(cb: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cb]);
  return ref;
}
