import type { CSSProperties } from "react";
import { money, percent } from "@/lib/format";

type WallProfile = {
  strike: number | null;
  openInterest: number;
  totalOpenInterest: number;
  share: number | null;
  dominance: number | null;
  strength: number | null;
  persistenceSnapshots: number;
};

function WallCard({ label, tone, profile }: { label: string; tone: "call" | "put"; profile: WallProfile }) {
  const strength = profile.strength ?? 0;
  const persistence = profile.persistenceSnapshots;
  return (
    <article className={`wall-strength-card ${tone}`}>
      <div><span>{label}</span><strong>{money(profile.strike)}</strong></div>
      <div className="wall-strength-score"><b>{profile.strength ?? "—"}</b><small>/ 100 强度</small></div>
      <div className="wall-strength-track" aria-label={`${label}强度 ${profile.strength ?? "暂无"}`}><i style={{ width: `${strength}%` }} /></div>
      <dl>
        <div><dt>OI 集中度</dt><dd>{percent(profile.share)}</dd></div>
        <div><dt>领先第二名</dt><dd>{profile.dominance === null ? "—" : `${profile.dominance.toFixed(2)}×`}</dd></div>
        <div><dt>连续出现</dt><dd>{persistence ? `${persistence} 个快照` : "—"}</dd></div>
      </dl>
    </article>
  );
}

export function WallStrengthVisual({ call, put }: { call: WallProfile; put: WallProfile }) {
  return (
    <section className="visual-card wall-strength-visual" aria-labelledby="wall-strength-title">
      <div className="visual-card-heading">
        <div><span>墙位质量</span><strong id="wall-strength-title">强度与持续性</strong></div>
        <small>越集中、越领先、连续出现越值得关注</small>
      </div>
      <div className="wall-strength-grid"><WallCard label="看涨墙" tone="call" profile={call} /><WallCard label="看跌墙" tone="put" profile={put} /></div>
      <p><b>怎么读：</b>强度综合该价位占同侧总 OI 的比例和对第二大价位的领先幅度；连续出现表示近期数据快照中墙位未变。</p>
      <small>强度是页面内部的相对分数，不代表该价位一定形成支撑或阻力；快照不等同于连续交易日。</small>
    </section>
  );
}

type TermPoint = { expiration: string; daysToExpiration: number; atmIv: number; contractCount: number };

export function IvStructureVisual({ currentIv, percentile, termStructure }: {
  currentIv: number | null;
  percentile: { percentile: number | null; sampleSize: number; label: string };
  termStructure: TermPoint[];
}) {
  const points = termStructure.slice(0, 8);
  const minIv = points.length ? Math.min(...points.map((point) => point.atmIv)) : 0;
  const maxIv = points.length ? Math.max(...points.map((point) => point.atmIv)) : 1;
  const span = Math.max(maxIv - minIv, 0.05);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 50 : 5 + index / (points.length - 1) * 90,
    y: 82 - (point.atmIv - minIv) / span * 62,
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const percentilePosition = percentile.percentile ?? 50;

  return (
    <section className="visual-card iv-structure-visual" aria-labelledby="iv-structure-title">
      <div className="visual-card-heading">
        <div><span>波动位置</span><strong id="iv-structure-title">IV 百分位＋期限结构</strong></div>
        <small>当前 ATM IV {percent(currentIv)}</small>
      </div>
      <div className="iv-insight-grid">
        <div className="iv-percentile-card">
          <span>近期历史位置</span><strong>{percentile.percentile === null ? "样本积累中" : `${percentile.percentile}%`}</strong><b>{percentile.label}</b>
          <div className="iv-percentile-track" style={{ "--iv-position": `${percentilePosition}%` } as CSSProperties}><i /></div>
          <div><small>偏低</small><small>中位</small><small>偏高</small></div>
          <p>{percentile.sampleSize} 个日终 ATM IV 快照样本</p>
        </div>
        <div className="iv-term-card">
          <div><span>不同到期日 ATM IV</span><b>{points.length ? `${points[0].daysToExpiration}–${points.at(-1)!.daysToExpiration} 天` : "暂无"}</b></div>
          {points.length ? <>
            <svg viewBox="0 0 100 100" role="img" aria-label="期权隐含波动率期限结构">
              <path d={path} />
              {coordinates.map((point) => <circle cx={point.x} cy={point.y} r="2.4" key={point.expiration} />)}
            </svg>
            <div className="iv-term-labels">{coordinates.map((point) => <span key={point.expiration}><b>{point.daysToExpiration}天</b><small>{percent(point.atmIv)}</small></span>)}</div>
          </> : <div className="mini-empty">暂无多到期日 IV 数据</div>}
        </div>
      </div>
      <p><b>怎么读：</b>百分位回答“当前 IV 在已有历史中高不高”；期限结构回答“近期事件风险还是远期不确定性被定价得更高”。</p>
      <small>当前历史样本最多使用 60 个可用快照；样本较少时只做描述，不作长周期统计结论。</small>
    </section>
  );
}
