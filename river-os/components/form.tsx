"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/actions/types";

const PendingContext = createContext(false);

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "Salvando…", name, value }: { children: ReactNode; className?: string; pendingText?: string; name?: string; value?: string }) {
  const formPending = useFormStatus().pending;
  const ctxPending = useContext(PendingContext);
  const pending = formPending || ctxPending;
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Formulário com estado de carregamento, erro e confirmação vindos do Server Action. */
export function ActionForm({
  action, children, className, resetOnSuccess = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  // onSubmit (e não action=) evita que o React 19 limpe os campos quando a validação falha.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null);
    startTransition(() => formAction(fd));
  }
  return (
    <form ref={ref} onSubmit={onSubmit} className={className}>
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state?.error && <p role="alert" className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-3 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}
      {state?.link && <CopyLink url={state.link} />}
    </form>
  );
}

function CopyLink({ url }: { url: string }) {
  return (
    <div className="mt-2 flex gap-2">
      <input readOnly className="input font-mono text-xs" value={url} aria-label="Link de aprovação" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(url)}>Copiar</button>
    </div>
  );
}

/** Botão que pede confirmação antes de uma ação destrutiva. */
export function ConfirmButton({ action, label, message, className = "btn btn-danger btn-sm", fields }: {
  action: (fd: FormData) => Promise<void> | void;
  label: ReactNode;
  message: string;
  className?: string;
  fields?: Record<string, string>;
}) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {Object.entries(fields ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton className={className} pendingText="…">{label}</SubmitButton>
    </form>
  );
}

/** Formulário de filtros: aplica ao mudar qualquer campo (GET, estado na URL). */
export function FilterForm({ children, className = "flex flex-wrap items-end gap-3" }: { children: ReactNode; className?: string }) {
  return (
    <form method="get" className={className} onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}>
      {children}
    </form>
  );
}
