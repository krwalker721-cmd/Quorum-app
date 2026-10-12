"use client";

// In-page stand-ins for window.confirm / prompt / alert, for the Sprint and
// countdown admin screens. Native dialogs can be switched off by the browser
// (the desktop app's preview pane answers every confirm() with "Cancel"), and
// then a save or publish silently does nothing. These are an HTML <dialog>,
// so they always show, in the admin console's look.
//
//   if (!(await askConfirm("Publish?"))) return;
//   const pick = await askChoice("Make them a judge.", [{ value: "accepted", label: "mark accepted" }, …]);
//   const typed = await askText("Type CANCEL to confirm.");
//   await tell("That time isn't valid.");
//
// Escape or the backdrop counts as cancel (false / null).

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Btn } from "./ui";

type Choice<T extends string> = { value: T; label: string; variant?: "primary" | "ghost" | "danger" };

type Spec = {
  message: string;
  choices: Choice<string>[];
  input?: { placeholder?: string };
};

function open(spec: Spec): Promise<{ value: string | null; text: string }> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (value: string | null, text: string) => {
      root.unmount();
      host.remove();
      resolve({ value, text });
    };
    root.render(<AskDialog spec={spec} onDone={done} />);
  });
}

function AskDialog({ spec, onDone }: { spec: Spec; onDone: (value: string | null, text: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const settled = useRef(false);
  const finish = (value: string | null) => {
    if (settled.current) return;
    settled.current = true;
    ref.current?.close();
    onDone(value, text);
  };

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const primary = spec.choices.find((c) => c.variant === "primary") ?? spec.choices[spec.choices.length - 1];

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        finish(null);
      }}
      onClick={(e) => {
        if (e.target === ref.current) finish(null); // the backdrop
      }}
      className="font-mono p-0 backdrop:bg-black/60"
      style={{
        width: "min(440px, calc(100vw - 32px))",
        border: "1px solid var(--border)",
        background: "var(--card, #161b22)",
        color: "var(--text-primary, #e6edf3)",
        borderRadius: 6,
      }}
    >
      <form
        method="dialog"
        className="p-4"
        onSubmit={(e) => {
          e.preventDefault();
          finish(primary.value);
        }}
      >
        <p className="text-[0.75rem] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary, #c9d1d9)" }}>
          {spec.message}
        </p>
        {spec.input && (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={spec.input.placeholder}
            aria-label="your answer"
            className="mt-3 w-full"
          />
        )}
        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <Btn onClick={() => finish(null)}>cancel</Btn>
          {spec.choices.map((c) => (
            <Btn
              key={c.value}
              type={c === primary ? "submit" : "button"}
              variant={c.variant ?? "primary"}
              autoFocus={!spec.input && c === primary}
              onClick={c === primary ? undefined : () => finish(c.value)}
            >
              {c.label}
            </Btn>
          ))}
        </div>
      </form>
    </dialog>
  );
}

/** OK / cancel. Resolves true only for OK. */
export async function askConfirm(message: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
  const { value } = await open({
    message,
    choices: [{ value: "ok", label: opts.ok ?? "ok", variant: opts.danger ? "danger" : "primary" }],
  });
  return value === "ok";
}

/** Several named answers (plus cancel). Resolves the chosen value, or null. */
export async function askChoice<T extends string>(message: string, choices: Choice<T>[]): Promise<T | null> {
  const { value } = await open({ message, choices });
  return value as T | null;
}

/** A typed answer. Resolves the text, or null on cancel. */
export async function askText(message: string, opts: { ok?: string; placeholder?: string; danger?: boolean } = {}): Promise<string | null> {
  const { value, text } = await open({
    message,
    choices: [{ value: "ok", label: opts.ok ?? "ok", variant: opts.danger ? "danger" : "primary" }],
    input: { placeholder: opts.placeholder },
  });
  return value === "ok" ? text : null;
}

/** A message with one button. */
export async function tell(message: string): Promise<void> {
  await open({ message, choices: [{ value: "ok", label: "ok" }] });
}
