// Decorative illustration only: this line never represents your portfolio data.
export function StonkLoader({
  phase = "loading",
}: {
  phase?: "loading" | "crash";
}) {
  return (
    <div className={`stonk-card stonk-${phase}`}>
      <div className="stonk-label">
        <span aria-hidden="true">↗</span> STONKS{" "}
        <span className="badge">
          {phase === "loading" ? "LOADING" : "READY"}
        </span>
      </div>
      <svg
        className="stonk-chart"
        viewBox="0 0 320 180"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="stonk-grid"
          d="M20 35H300 M20 80H300 M20 125H300 M65 20V160 M125 20V160 M185 20V160 M245 20V160"
        />
        <path
          className="stonk-ghost"
          d="M24 140 L60 124 L88 132 L120 94 L148 108 L180 65 L206 76 L252 32"
        />
        <path
          className="stonk-rise"
          pathLength="1"
          d="M24 140 L60 124 L88 132 L120 94 L148 108 L180 65 L206 76 L252 32"
        />
        <path
          className="stonk-drop"
          pathLength="1"
          d="M252 32 L267 78 L277 68 L296 149"
        />
        <circle className="stonk-tip" cx="252" cy="32" r="5" />
        <circle className="stonk-landing" cx="296" cy="149" r="6" />
      </svg>
      <div className="stonk-caption">
        <strong>
          {phase === "loading"
            ? "Only up… for now."
            : "And there’s the correction."}
        </strong>
        <span>
          {phase === "loading"
            ? "Getting your page ready"
            : "Your page is ready"}
        </span>
      </div>
      <small className="stonk-disclaimer">STONKS ONLY GO UP!</small>
    </div>
  );
}
