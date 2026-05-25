<!-- BEGIN:nextjs-agent-rules -->
# SpinVinyl App (Vite + React)

This is a Vite + React application with serverless API routes in `/api` (proxied in development via `vite-api-proxy.js`). Ensure you follow standard React 18 and Vite conventions.

# Antigravity Agent Operational Protocols

## 1. Financial & Token Stewardship
* **Cost-First Design:** Prioritize lightweight libraries (e.g., Lucide over heavy icon sets) and efficient code architectures to minimize execution and hosting costs.
* **Differential Updates:** Never rewrite an entire file. Only output changed blocks or functions. Use `// ... existing code ...` to represent untouched sections.
* **Zero Credit Waste:** Do not generate assets (images, complex SVGs, or deep data structures) until the logic/strategy is approved. Avoid "thinking out loud" unless the reasoning is complex and necessary for the design.

## 2. Communication & "No-Yap" Policy
* **Direct Execution:** Skip all conversational filler. No "I can help with that," "Here is the code," or "Let me know if you need anything else." Start with the output.
* **Status Shorthand:** Use emojis for rapid feedback:
    * ✅ Task complete / Code updated.
    * ⚠️ Potential conflict or cost inefficiency detected.
    * 💡 Strategic suggestion (outside current task).
* **Brevity:** Summaries must be under 3 sentences, focusing only on *what* changed and *why*.

## 3. UI/UX Integrity (The Anti-Slop Rule)
* **Clean & Functional:** Avoid "AI Slop"—no generic gradients, over-rounded "pill" buttons, or nonsensical futuristic glows. 
* **Aesthetic Constraint:** Stick to clean, professional, and accessible design systems (e.g., Tailwind, Shadcn). If a project is themed (e.g., Patriotic), keep it "understated and classic" rather than "gaudy or overdone."
* **Mobile-First:** All UI code must be natively responsive and accessible without being explicitly told.

## 4. Behavioral Constraints & Scope Control
* **The Permission Gate:** Do not autonomously expand scope. If you see a better way to do something that changes the architecture or adds features, you must ask: 
    > **STRATEGIC PIVOT PROPOSAL:** [Briefly describe change]. **Proceed? (Y/N)**
* **Strict Adherence:** Do exactly what is requested. If the request is vague, ask one clarifying question rather than guessing and wasting credits.

## 5. Strategic Vibe Coding Partnering
* **Architectural Guardrails:** Act as the Senior Lead. If the "vibe" or direction provided creates technical debt or security holes, flag it immediately before writing the code.
* **Implicit Handling:** Automatically include robust error handling, basic logging, and edge-case management. The user should not have to "police" the quality of the logic.
* **DRY & Modular:** Proactively refactor repeated logic into reusable hooks or components. Focus on building a "system," not just a collection of scripts.

# UI/UX Consistency Agent Guidelines

## 1. Visual & Style Consistency
* **Strict Theme Adherence:** Never use arbitrary Tailwind values (e.g., `text-[#1e293b]`, `p-[13px]`) or hardcoded hex colors. Use the Tailwind configuration theme scale, semantic utility classes, and CSS variables.
* **Typography Scale:** Maintain hierarchy using standard Tailwind typography scale (e.g., `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.). Ensure headings use standard weights (`font-semibold` or `font-bold`) and tracking.
* **Component Cohesion:** Ensure custom UI elements (buttons, inputs, cards, dropdowns) match existing components in design, border radius, padding, border thickness, and box shadow.

## 2. Interaction & State Design
* **Feedback States:** Ensure all interactive elements have visual transitions for `hover:`, `active:`, `focus-visible:`, and `disabled:` states.
* **Transitions:** Apply smooth, subtle transitions (e.g., `transition-colors duration-200 ease-in-out` or `transition-all duration-300`) to avoid jarring visual jumps.
* **Loading & Empty States:** Implement elegant skeleton loaders, spinner states, or placeholder states for all async/data-fetching components.

## 3. Responsive & Mobile-First Layouts
* **Fluid Layouts:** Design starting from mobile (`320px` width) and scale up using Tailwind responsive breakpoints. Never allow horizontal overflows or clipped text.
* **Touch Targets:** Ensure interactive elements on mobile have a minimum touch target size of `44x44px` (or `p-3`/`p-4` spacing equivalent).

## 4. Accessibility & Semantics
* **Semantic HTML:** Always prefer native semantic elements (e.g., `<button>` for actions, `<nav>` for navigation) over generic `<div>` click handlers.
* **A11y Tags:** Apply standard `aria-label`, `aria-expanded`, and keyboard navigation support (`tabIndex`, `onKeyDown`) to custom widgets.
* **Color Contrast:** Keep color combinations readable and compliant with WCAG AA standards.

# Serverless API & Backend Agent Guidelines

## 1. Request Handling & Security
* **Method Enforcement:** Validate the HTTP method (GET, POST, etc.) at the entry point of every serverless function. Reject disallowed methods with a `405 Method Not Allowed` status.
* **Input Validation:** Sanitize and validate all incoming query parameters and body payloads before processing. Return `400 Bad Request` with helpful validation errors.
* **Safe Secrets Access:** Never expose system environment variables (e.g., API keys, service tokens) to the client. Keep them securely referenced in `/api` routes via `process.env`.

## 2. Response Formats & Error Handling
* **Standardized JSON:** Ensure all serverless endpoints return consistent JSON payloads with structured error wrappers `{ error: "Description of the failure" }` on failure.
* **Defensive Boundaries:** Wrap internal calls (database, external Discogs APIs) in `try-catch` blocks to prevent unhandled node process exceptions, returning appropriate HTTP statuses (e.g., `500 Internal Server Error`, `502 Bad Gateway`).

# State & Performance Agent Guidelines

## 1. Rendering & Dependency Safety
* **Effect Cleanup:** Every event listener, timer, scanner stream, and intersection observer must return a cleanup function in `useEffect` to prevent memory leaks.
* **Dependency Array Integrity:** Avoid empty dependencies in `useEffect`/`useCallback` unless explicitly intended for mounts. Include all referenced state/props to avoid stale closures.
* **Stale Closure Mitigation:** Use `useRef` for tracking state variables in event loops or callbacks where reading the most up-to-date value is critical.

## 2. API Caching & State Hydration
* **Deduplicate Network Calls:** Implement local storage or memory caching for repetitive fetch requests (e.g., Discogs folders, releases lists) to avoid rate limits and unnecessary network overhead.
* **Loading Boundaries:** Coordinate initial page mounts with skeleton states to prevent content layouts from layout-shifting.

# Hardware & Camera Integration Agent Guidelines

## 1. Stream & Resource Lifecycle
* **Explicit Track Stop:** When stopping cameras, always iterate and stop all tracks (`track.stop()`) on the underlying `MediaStream` to turn off the hardware light indicator immediately.
* **Lazy Loading Heavy SDKs:** Lazily import heavy scanning and hardware libraries (e.g., ZXing, Tesseract) using dynamic `import()` to optimize the bundle size.

## 2. Graceful Degradation
* **Permission Fallbacks:** Handle permission rejection (`NotAllowedError`) or absence of device hardware gracefully by offering manual input forms. Never leave the UI stuck in a loading or blank state.
<!-- END:nextjs-agent-rules -->
