import React, { useEffect, useRef, useState } from "react";
import "./sidebar-resize.css";

export function useSidebarWidth(side: "left" | "right", scope: string = side) {
  const key = "mw-sidebar-width:" + scope;
  const [width, setWidth] = useState<number | undefined>(() => {
    try {
      return Number(localStorage.getItem(key)) || undefined;
    } catch {
      return undefined;
    }
  });
  const save = (next: number) => {
    try {
      localStorage.setItem(key, String(next));
    } catch {}
  };
  return { width, setWidth, save };
}

export function SidebarResize({
  side,
  controls,
  setWidth,
  save,
  label,
}: {
  side: "left" | "right";
  controls: string;
  label?: string;
  setWidth: (width: number) => void;
  save: (width: number) => void;
}) {
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    width: number;
    last: number;
  } | null>(null);
  const [measured, setMeasured] = useState(0);
  const minimum = side === "left" ? 200 : 300;
  const maximum = () =>
    side === "left"
      ? 420
      : Math.min(
          760,
          (handle.current?.parentElement?.parentElement?.clientWidth || 0) -
            (window.innerWidth > 1140 ? 370 : 32),
        );
  const readWidth = () =>
    Math.round(
      handle.current?.parentElement?.getBoundingClientRect().width || 0,
    );
  const apply = (desired: number) => {
    const width = Math.max(minimum, Math.min(maximum(), Math.round(desired)));
    setWidth(width);
    return width;
  };
  useEffect(() => {
    const pane = handle.current?.parentElement;
    if (!pane) return;
    const measure = () => setMeasured(readWidth());
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);
  const finish = (event: React.PointerEvent) => {
    if (drag.current?.pointer !== event.pointerId) return;
    if (drag.current.last !== drag.current.width) save(drag.current.last);
    drag.current = null;
    handle.current?.removeAttribute("data-dragging");
  };
  return (
    <div
      ref={handle}
      role="separator"
      tabIndex={0}
      aria-label={
        label || (side === "left" ? "调整左侧栏宽度" : "调整视图预览宽度")
      }
      aria-controls={controls}
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={Math.max(minimum, maximum())}
      aria-valuenow={measured || undefined}
      className={"mw-sidebar-resize mw-sidebar-resize-" + side}
      onPointerDown={(e) => {
        if (e.button !== 0 || drag.current) return;
        const width = readWidth();
        drag.current = {
          pointer: e.pointerId,
          x: e.clientX,
          width,
          last: width,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.setAttribute("data-dragging", "");
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        const current = drag.current;
        if (!current || current.pointer !== e.pointerId) return;
        current.last = apply(
          current.width + (e.clientX - current.x) * (side === "left" ? 1 : -1),
        );
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onKeyDown={(e) => {
        const movement =
          e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
        if (!movement && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        save(
          apply(
            e.key === "Home"
              ? minimum
              : e.key === "End"
                ? maximum()
                : readWidth() +
                  movement *
                    (side === "left" ? 1 : -1) *
                    (e.shiftKey ? 32 : 12),
          ),
        );
      }}
    />
  );
}
