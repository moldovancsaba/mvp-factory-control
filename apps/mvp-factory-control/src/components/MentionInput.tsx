//> String literal line.
"use client";

/**
 * Text input with **@mention** autocomplete (agents/humans). Detects `@query` before caret; Tab/Enter selects.
 * Submits composed value through the wrapping form; mentionables passed from server page.
 */
//> Import bindings from a module.
import { useEffect, useMemo, useRef, useState } from "react";
//> Import bindings from a module.
import type { Mentionable } from "@/lib/mentionables";

//> Function declaration.
function mentionContext(value: string, caret: number) {
  //> Variable declaration.
  const left = value.slice(0, caret);
  //> Variable declaration.
  const match = /(?:^|\s)@([A-Za-z0-9_-]*)$/.exec(left);
  //> Conditional branch.
  if (!match) return null;
  //> Variable declaration.
  const query = match[1] ?? "";
  //> Variable declaration.
  const start = caret - query.length - 1;
  //> Return a value.
  return { query, start, end: caret };
//> Brace or statement terminator.
}

//> Export declaration.
export function MentionInput(props: {
  //> Source statement or expression.
  name: string;
  //> Source statement or expression.
  placeholder?: string;
  //> Source statement or expression.
  mentionables: Mentionable[];
//> Source statement or expression.
}) {
  //> Variable declaration.
  const ref = useRef<HTMLInputElement>(null);
  //> Variable declaration.
  const [value, setValue] = useState("");
  //> Variable declaration.
  const [caret, setCaret] = useState(0);
  //> Variable declaration.
  const [activeIndex, setActiveIndex] = useState(0);

  //> Source statement or expression.
  useEffect(() => {
    //> Variable declaration.
    const input = ref.current;
    //> Variable declaration.
    const form = input?.form;
    //> Conditional branch.
    if (!form) return;

    //> Const with function or expression.
    const onSubmit = (event: Event) => {
      //> Const with function or expression.
      const trimmed = (ref.current?.value ?? "").trim();
      //> Conditional branch.
      if (!trimmed) {
        //> Source statement or expression.
        event.preventDefault();
        //> Return to caller.
        return;
      //> Brace or statement terminator.
      }
      // Clear after the submit event completes so form data is captured first.
      //> Source statement or expression.
      setTimeout(() => {
        //> Source statement or expression.
        setValue("");
        //> Source statement or expression.
        setCaret(0);
        //> Source statement or expression.
        setActiveIndex(0);
      //> Source statement or expression.
      }, 0);
    //> Brace or statement terminator.
    };

    //> Source statement or expression.
    form.addEventListener("submit", onSubmit);
    //> Return a value.
    return () => form.removeEventListener("submit", onSubmit);
  //> Source statement or expression.
  }, []);

  //> Variable declaration.
  const ctx = mentionContext(value, caret);
  //> Variable declaration.
  const suggestions = useMemo(() => {
    //> Conditional branch.
    if (!ctx) return [];
    //> Variable declaration.
    const q = ctx.query.toLowerCase();
    //> Variable declaration.
    const filtered = props.mentionables.filter((m) => {
      //> Return a value.
      return (
        //> Source statement or expression.
        m.handle.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    });
    //> Return a value.
    return filtered.slice(0, 8);
  //> Source statement or expression.
  }, [ctx, props.mentionables]);

  //> Variable declaration.
  const show = Boolean(ctx && suggestions.length > 0);

  //> Function declaration.
  function replaceMention(handle: string) {
    //> Conditional branch.
    if (!ctx) return;
    //> Variable declaration.
    const next = `${value.slice(0, ctx.start)}@${handle} ${value.slice(ctx.end)}`;
    //> Source statement or expression.
    setValue(next);
    //> Source statement or expression.
    setActiveIndex(0);
    //> Source statement or expression.
    requestAnimationFrame(() => {
      //> Conditional branch.
      if (!ref.current) return;
      //> Variable declaration.
      const pos = ctx.start + handle.length + 2;
      //> Source statement or expression.
      ref.current.focus();
      //> Source statement or expression.
      ref.current.setSelectionRange(pos, pos);
      //> Source statement or expression.
      setCaret(pos);
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return (
    <div className="relative w-full">
      <input
        ref={ref}
        name={props.name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
          setActiveIndex(0);
        }}
        onClick={(e) => setCaret(e.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(e) => {
          const t = e.currentTarget;
          setCaret(t.selectionStart ?? t.value.length);
        }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            replaceMention(suggestions[activeIndex].handle);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setActiveIndex(0);
          }
        }}
        placeholder={props.placeholder}
        className="ui-input"
      />

      {show ? (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-full overflow-hidden rounded-[1rem] border border-white/15 bg-[#0c1428] shadow-lg">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={`${s.kind}:${s.handle}`}
              onMouseDown={(e) => {
                e.preventDefault();
                replaceMention(s.handle);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                i === activeIndex ? "bg-white/10" : "hover:bg-white/6"
              }`}
            >
              <div className="truncate text-white/90">
                @{s.handle}
                <span className="ml-2 text-white/60">{s.label}</span>
              </div>
              <div className="ml-3 ui-badge">
                {s.kind}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
//> Brace or statement terminator.
}
