"use client";

import { useState, type CSSProperties } from "react";
import { money, percent } from "@/lib/format";
import type { IvSkewResult } from "@/lib/indicators/options/iv-skew";

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
  const historyLabel = persistence === 0 ? "暂无墙位记录" : persistence === 1 ? "只有1份记录" : `连续 ${persistence} 份记录`;
  return (
    <article className={`wall-strength-card ${tone}`}>
      <div><span>{label}</span><strong>{money(profile.strike)}</strong></div>
      <div className="wall-strength-score"><b>{profile.strength ?? "—"}</b><small>/ 100 集中强度</small></div>
      <div className="wall-strength-track" aria-label={`${label}强度 ${profile.strength ?? "暂无"}`}><i style={{ width: `${strength}%` }} /></div>
      <dl>
        <div><dt>占同侧全部未平仓量</dt><dd>{percent(profile.share)}</dd></div>
        <div><dt>是第二名的</dt><dd>{profile.dominance === null ? "—" : `${profile.dominance.toFixed(2)}×`}</dd></div>
        <div><dt>近期记录</dt><dd>{persistence ? historyLabel : "—"}</dd></div>
      </dl>
    </article>
  );
}

export function WallStrengthVisual({ call, put }: { call: WallProfile; put: WallProfile }) {
  return (
    <section className="visual-card wall-strength-visual" aria-labelledby="wall-strength-title">
      <div className="visual-card-heading">
        <div><span>这个墙位明显吗</span><strong id="wall-strength-title">集中强度与近期稳定性</strong></div>
        <small>强度看集中程度；记录数量单独看是否持续</small>
      </div>
      <div className="wall-strength-grid"><WallCard label="看涨墙" tone="call" profile={call} /><WallCard label="看跌墙" tone="put" profile={put} /></div>
      <p><b>怎么算：</b>集中强度只由“占同侧全部未平仓量的比例”和“领先第二名多少”计算；连续记录不参与分数。</p>
      <small>分数不是上涨或守住的概率，也不保证形成支撑或阻力；保存记录不一定对应连续交易日。</small>
    </section>
  );
}

type TermPoint = { expiration: string; daysToExpiration: number; atmIv: number; contractCount: number };

export function IvStructureVisual({ currentIv, percentile, termStructure, skew }: {
  currentIv: number | null;
  percentile: { percentile: number | null; sampleSize: number; label: string };
  termStructure: TermPoint[];
  skew: IvSkewResult;
}) {
  const [view, setView] = useState<"TERM" | "SKEW">("TERM");
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

  const skewValues = skew.points.flatMap((point) => [point.callIv, point.putIv]).filter((value): value is number => value !== null && Number.isFinite(value));
  const skewMinimum = skewValues.length ? Math.min(...skewValues) : 0;
  const skewMaximum = skewValues.length ? Math.max(...skewValues) : 1;
  const skewSpan = Math.max(skewMaximum - skewMinimum, 0.05);
  const skewX = (moneyness: number) => 7 + (moneyness - 0.8) / 0.4 * 86;
  const skewY = (iv: number) => 84 - (iv - skewMinimum) / skewSpan * 66;
  const skewPath = (side: "callIv" | "putIv") => skew.points
    .filter((point) => point[side] !== null)
    .map((point, index) => `${index ? "L" : "M"} ${skewX(point.moneyness)} ${skewY(point[side]!)}`).join(" ");

  return (
    <section className="visual-card iv-structure-visual" aria-labelledby="iv-structure-title">
      <div className="visual-card-heading">
        <div><span>期权预计的波动高不高</span><strong id="iv-structure-title">{view === "TERM" ? "和最近记录、不同到期日比较" : "Put 与 Call 的定价差"}</strong></div>
        <div className="iv-view-switch" aria-label="切换期权波动比较"><button type="button" className={view === "TERM" ? "active" : ""} onClick={() => setView("TERM")}>不同到期日</button><button type="button" className={view === "SKEW" ? "active" : ""} onClick={() => setView("SKEW")}>Put/Call差异</button></div>
      </div>
      {view === "TERM" ? <><div className="iv-insight-grid">
        <div className="iv-percentile-card">
          <span>当前期权预估波动和最近记录比</span><strong>{percentile.percentile === null ? "样本积累中" : `比已有 ${percentile.percentile}% 的收盘记录更高`}</strong><b>{percentile.label}</b>
          <div className="iv-percentile-track" style={{ "--iv-position": `${percentilePosition}%` } as CSSProperties}><i /></div>
          <div><small>偏低</small><small>中位</small><small>偏高</small></div>
          <p>基于 {percentile.sampleSize} 份收盘记录</p>
        </div>
        <div className="iv-term-card">
          <div><span>各到期日的期权预估波动</span><b>{points.length ? `${points[0].daysToExpiration}–${points.at(-1)!.daysToExpiration} 天` : "暂无"}</b></div>
          {points.length ? <>
            <svg viewBox="0 0 100 100" role="img" aria-label="不同到期日的期权预估波动">
              <path d={path} />
              {coordinates.map((point) => <circle cx={point.x} cy={point.y} r="2.4" key={point.expiration} />)}
            </svg>
            <div className="iv-term-labels">{coordinates.map((point) => <span key={point.expiration}><b>{point.daysToExpiration}天</b><small>{percent(point.atmIv)}</small></span>)}</div>
          </> : <div className="mini-empty">暂无多个到期日的波动数据</div>}
        </div>
      </div>
      <p><b>怎么读：</b>左侧看当前期权预估波动比最近记录高还是低；右侧只比较近月和远月哪个数值更高，不判断形成原因。</p>
      <small>只使用页面已经保存的记录；样本较少时仅作短期比较，不代表长期历史位置。</small>
      </> : <div className="iv-skew-panel">
        <div className="iv-skew-summary"><div><span>Put IV 减去 Call IV</span><strong>{skew.riskReversalVolPoints === null ? "—" : `${skew.riskReversalVolPoints >= 0 ? "+" : ""}${skew.riskReversalVolPoints.toFixed(1)} 个波动率点`}</strong><b>{skew.label}</b></div><small>{skew.expiration ? `${skew.expiration} · ${skew.daysToExpiration}天｜Put ${percent(skew.put25Iv)} · Call ${percent(skew.call25Iv)}` : "暂无可用到期日"}</small></div>
        {skew.points.length >= 5 && skewValues.length ? <div className="iv-skew-chart"><div className="iv-skew-legend"><span><i className="call" />看涨 Call</span><span><i className="put" />看跌 Put</span><span>现价附近 IV {percent(currentIv)}</span></div><svg viewBox="0 0 100 100" role="img" aria-label={`Put 与 Call 的期权预估波动差异，${skew.label}`}>
          {[0.8, 1, 1.2].map((mark) => <g key={mark}><line x1={skewX(mark)} x2={skewX(mark)} y1="15" y2="86" className={mark === 1 ? "atm-grid" : "skew-grid"} /><text x={skewX(mark)} y="97" textAnchor="middle">{Math.round(mark * 100)}%</text></g>)}
          <path d={skewPath("callIv")} className="call" /><path d={skewPath("putIv")} className="put" />
          {skew.points.map((point) => <g key={point.strike}>{point.callIv !== null && <circle cx={skewX(point.moneyness)} cy={skewY(point.callIv)} r="1.6" className="call" />}{point.putIv !== null && <circle cx={skewX(point.moneyness)} cy={skewY(point.putIv)} r="1.6" className="put" />}</g>)}
        </svg><div className="iv-skew-axis">行权价相对现价</div></div> : <div className="sample-building"><strong>样本积累中</strong><span>{skew.reason}</span></div>}
        <p><b>怎么读：</b>{skew.status === "AVAILABLE" ? `${skew.label}，表示 Put 和 Call 两侧的期权定价不同。` : skew.reason}</p>
        <small>这里只比较两侧定价，不预测价格方向；计算选择至少7天、尽量接近30天，并且对价格敏感度相近的一组 Put 与 Call（Delta 约25%）。</small>
      </div>}
    </section>
  );
}
