import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

/**
 * 열린 바텀시트·다이얼로그를 뒤로가기로 닫기 위한 등록부.
 * TDS 오버레이는 AIT backEvent를 직접 구독하지 않으므로 앱의 단일 backEvent 처리기가
 * 가장 최근에 열린 오버레이부터 닫는다.
 */
export interface OverlayRegistry {
  register(close: () => void): () => void;
  hasOpen(): boolean;
  closeTop(): void;
}

export function createOverlayRegistry(): OverlayRegistry {
  const stack: Array<() => void> = [];
  return {
    register(close) {
      stack.push(close);
      return () => {
        const index = stack.lastIndexOf(close);
        if (index >= 0) stack.splice(index, 1);
      };
    },
    hasOpen: () => stack.length > 0,
    closeTop() {
      stack[stack.length - 1]?.();
    },
  };
}

const OverlayContext = createContext<OverlayRegistry | null>(null);

export function OverlayBackProvider({
  registry,
  children,
}: {
  registry: OverlayRegistry;
  children: ReactNode;
}) {
  return <OverlayContext.Provider value={registry}>{children}</OverlayContext.Provider>;
}

/** open인 동안 뒤로가기가 onClose를 호출하도록 등록한다. */
export function useCloseOnBack(open: boolean, onClose: () => void): void {
  const registry = useContext(OverlayContext);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !registry) return;
    return registry.register(() => onCloseRef.current());
  }, [open, registry]);
}
