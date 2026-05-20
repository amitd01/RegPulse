"use client";

export function LandingScrollHint() {
  return (
    <button
      type="button"
      className="landing-scroll-hint"
      onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
    >
      <div className="landing-scroll-mouse">
        <div className="landing-scroll-dot" />
      </div>
      Scroll
    </button>
  );
}
