export default function Loading() {
  return (
    <div className="pf-wrap" aria-busy="true" aria-label="Loading job details">
      <div className="skel skel-back" />
      <div className="pf-card jd-card">
        <div className="job-head">
          <div className="skel skel-icon" />
          <div className="job-top">
            <div className="skel skel-line" style={{ width: "42%" }} />
            <div className="skel skel-line" style={{ width: "18%" }} />
          </div>
        </div>
        <div className="skel skel-title" />
        <div className="skel skel-line" style={{ width: "55%" }} />
        <div className="tags">
          {["64", "88", "72", "96"].map((w, i) => (
            <div key={i} className="skel skel-pill" style={{ width: `${w}px` }} />
          ))}
        </div>
        <div className="job-actions">
          {["132", "98", "104", "96"].map((w, i) => (
            <div key={i} className="skel skel-btn" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
      <div className="jd-grid">
        {[0, 1].map((i) => (
          <div className="pf-card" key={i}>
            <div className="skel skel-h" />
            <div className="skel skel-line" style={{ width: "82%" }} />
            <div className="tags">
              {["70", "84", "62", "92", "76", "68", "80", "66"].map((w, k) => (
                <div key={k} className="skel skel-pill" style={{ width: `${w}px` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="pf-card">
        <div className="skel skel-h" />
        <div className="skel skel-line" style={{ width: "100%" }} />
        <div className="skel skel-line" style={{ width: "100%" }} />
        <div className="skel skel-line" style={{ width: "64%" }} />
      </div>
    </div>
  );
}
