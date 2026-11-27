import { useEffect, useState, useRef, Component, type ReactNode } from "react";
import { A2uiSurface, type ReactCatalogComponent } from "@a2ui/react";
import { MessageProcessor } from "@a2ui/web_core/processing";
import type { ActionListener } from "@a2ui/web_core/state";
import { a2uiData, validateA2ui, A2UI_SDK } from "./a2ui-contract";
import { reactAnswerCatalog } from "./a2ui-renderers";
import { AnswerUiScopeContext } from "./a2ui-ui";
import type { DynamicAnswer, DynamicSection } from "./dynamic-contract";
import { text } from "../team/client";

export function createAnswerSurface(
  answer: DynamicAnswer,
  section: DynamicSection,
  onAction: ActionListener,
) {
  const processor = new MessageProcessor<ReactCatalogComponent>(
    [reactAnswerCatalog],
    onAction,
    { version: "v1.0" },
  );
  const surfaceId = `a${answer.attemptId}_${section.id}`;
  let seq = -1;
  let disposed = false;
  const attempt = answer.attemptId;
  let hash = "";
  const update = (next: DynamicAnswer, nextSection: DynamicSection) => {
    if (disposed || next.attemptId !== attempt || next.seq <= seq) return false;
    if (hash && hash !== nextSection.hash)
      throw Error("surface_version_changed");
    const data = a2uiData(next, nextSection);
    const definition = validateA2ui(nextSection.surface, data);
    if (seq === -1)
      processor.processMessages({
        version: "1.0",
        createSurface: { surfaceId, catalogId: reactAnswerCatalog.id },
      });
    processor.processMessages({
      version: "1.0",
      updateDataModel: { surfaceId, path: "/", value: data },
    });
    if (hash !== nextSection.hash)
      processor.processMessages({
        version: "1.0",
        updateComponents: { surfaceId, components: definition.components },
      });
    seq = next.seq;
    hash = nextSection.hash;
    return true;
  };
  try {
    update(answer, section);
  } catch (e) {
    processor.dispose();
    throw e;
  }
  const surface = processor.model.getSurface(surfaceId);
  if (!surface) {
    processor.dispose();
    throw Error("missing_surface");
  }
  return {
    surface,
    hash: section.hash,
    update,
    dispose() {
      if (!disposed) {
        disposed = true;
        processor.dispose();
      }
    },
  };
}
function SurfaceContent({
  answer,
  section,
  onAction,
  fallback,
}: {
  answer: DynamicAnswer;
  section: DynamicSection;
  onAction: ActionListener;
  fallback: ReactNode;
}) {
  const [runtime, setRuntime] = useState<ReturnType<
    typeof createAnswerSurface
  > | null>(null);
  const [failed, setFailed] = useState(false);
  const callback = useRef(onAction);
  callback.current = onAction;
  useEffect(() => {
    setFailed(false);
    let active: ReturnType<typeof createAnswerSurface> | undefined;
    try {
      active = createAnswerSurface(answer, section, (a) => callback.current(a));
      setRuntime(active);
    } catch {
      setFailed(true);
    }
    return () => {
      active?.dispose();
    };
  }, [answer.attemptId, section.id, section.hash]);
  useEffect(() => {
    if (runtime && runtime.hash === section.hash) {
      try {
        runtime.update(answer, section);
      } catch {
        setFailed(true);
      }
    }
  }, [runtime, answer, section]);
  if (failed) return fallback;
  return (
    <div data-render={A2UI_SDK} data-region={section.id}>
      {runtime && (
        <AnswerUiScopeContext.Provider value={section.id}>
          <A2uiSurface surface={runtime.surface} />
        </AnswerUiScopeContext.Provider>
      )}
    </div>
  );
}

class SurfaceBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function AnswerSurface(props: {
  answer: DynamicAnswer;
  section: DynamicSection;
  onAction: ActionListener;
}) {
  const fallback = (
    <div role="status" className="wb-fallback">
      <p>{text("wb.layoutFallback")}</p>
      {(props.section.contentRefs || []).map((id) => (
        <p key={id}>{props.answer.claims[id]?.text}</p>
      ))}
    </div>
  );
  return (
    <SurfaceBoundary
      key={`${props.answer.attemptId}:${props.section.hash}`}
      fallback={fallback}
    >
      <SurfaceContent {...props} fallback={fallback} />
    </SurfaceBoundary>
  );
}
