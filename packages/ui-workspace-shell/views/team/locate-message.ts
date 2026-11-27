import {useEffect, useRef} from "react";
import {locate} from "./relations";

export function useMessageAnchor(prefix: string, id: string | null, available: boolean) {
  const located = useRef("");
  useEffect(() => {
    const target = id ? prefix + id : "";
    if (!available || !target) located.current = "";
    else if (located.current !== target && locate(target)) located.current = target;
  }, [prefix,id,available]);
}
