type Point = { strike: number; callOi: number; putOi: number };

export function OptionOiChart({ data }: { data: Point[] }) {
  if (!data.length) return <div className="chart-empty">Options data unavailable</div>;
  const max = Math.max(...data.flatMap((point) => [point.callOi, point.putOi]), 1);
  return (
    <div className="oi-scroll" role="img" aria-label="Call and put open interest by strike">
      <div className="oi-chart" style={{ minWidth: Math.max(640, data.length * 46) }}>
        {data.map((point) => (
          <div className="oi-column" key={point.strike} title={`Strike ${point.strike}: Call ${point.callOi}, Put ${point.putOi}`}>
            <div className="oi-bars">
              <i className="oi-bar call" style={{ height: `${(point.callOi / max) * 100}%` }} />
              <i className="oi-bar put" style={{ height: `${(point.putOi / max) * 100}%` }} />
            </div>
            <span>{point.strike}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
