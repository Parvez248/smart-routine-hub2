"use client";

// The print surface for the exam documents (Step 51).
//
// Printing here has to meet one hard constraint: it must not disturb the
// class routine's print (Step 46), which gets its landscape page from a
// <style> that exists only while a routine page is mounted. This uses the
// same proven trick — scoping by existence — twice over:
//
//   * the stylesheet below is injected only while a print is in flight and
//     removed immediately after, so no exam rule is ever in effect while
//     the class routine prints;
//   * every rule is additionally scoped to `body.exam-printing` or to the
//     portal's own class, so even if the two ever coexisted they wouldn't
//     collide.
//
// The document is rendered into a portal on <body> rather than inside the
// page, which makes "print this and nothing else" a single CSS rule instead
// of a hunt for every piece of app chrome to hide.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const EXAM_PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }

body.exam-printing > *:not(.exam-print-portal) { display: none !important; }
body.exam-printing .exam-print-portal { display: block !important; }

.exam-print-portal {
  color: #16202b;
  background: #ffffff;
  font-size: 10pt;
  line-height: 1.35;
}
.exam-print-portal .exam-page { break-before: page; position: relative; }
.exam-print-portal .exam-page:first-child { break-before: auto; }
.exam-print-portal table {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
}
.exam-print-portal thead { display: table-header-group; }
.exam-print-portal tr { break-inside: avoid; }
.exam-print-portal th,
.exam-print-portal td {
  border: 0.6pt solid #b9c0c8;
  padding: 3.5pt 5pt;
  text-align: left;
  vertical-align: top;
}
.exam-print-portal th {
  font-weight: 700;
  background: #f1f3f5 !important;
}
/* Keep one date + sitting together on a page when it fits. */
.exam-print-portal .sheet-block { break-inside: avoid; }
.exam-print-portal .draft-mark {
  position: fixed;
  top: 42%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 68pt;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #16202b;
  opacity: 0.08;
  transform: rotate(-24deg);
  pointer-events: none;
}
`;

/**
 * Renders `children` as the printed document and calls `window.print()`,
 * then tells the caller it's finished. `job` is a counter: give it a new
 * number to print again, and `null` once done.
 */
export function ExamPrintSurface({
  job,
  onDone,
  children,
}: {
  job: number | null;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  if (hostRef.current === null && typeof document !== "undefined") {
    const host = document.createElement("div");
    host.className = "exam-print-portal";
    // Never visible on screen; the print rule above turns it back on.
    host.style.display = "none";
    hostRef.current = host;
  }
  const host = hostRef.current;

  useEffect(() => {
    if (!host || job === null) return;

    // React has already rendered the document into `host` by the time this
    // effect runs, so it is complete the moment it joins the page.
    document.body.appendChild(host);
    document.body.classList.add("exam-printing");

    const style = document.createElement("style");
    style.media = "print";
    style.textContent = EXAM_PRINT_CSS;
    document.head.appendChild(style);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDoneRef.current();
    };

    window.addEventListener("afterprint", finish);
    const printTimer = window.setTimeout(() => window.print(), 80);
    // Not every browser fires `afterprint` (and a headless one never
    // prints at all), so the surface always tears itself down regardless.
    const failSafe = window.setTimeout(finish, 2500);

    return () => {
      window.clearTimeout(printTimer);
      window.clearTimeout(failSafe);
      window.removeEventListener("afterprint", finish);
      if (style.parentNode) style.parentNode.removeChild(style);
      document.body.classList.remove("exam-printing");
      if (host.parentNode) host.parentNode.removeChild(host);
    };
  }, [host, job]);

  if (!host || job === null) return null;
  return createPortal(children, host);
}
