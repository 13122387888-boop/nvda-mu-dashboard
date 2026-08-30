import { money, percent } from "@/lib/format";
import type { VolumeProfile } from "@/lib/indicators/volume-profile";

export function VolumeProfileVisual({ profile, close }: { profile: VolumeProfile; close: number }) {
  if (profile.status === "UNAVAILABLE" || !profile.bins.length) {
    return <div className="chart-empty">暂无分钟成交数据，暂时无法计算成交分布。</div>;
  }
  const maximumVolume = Math.max(...profile.bins.map((bin) => bin.volume), 1);
  const maximumPrice = profile.bins.at(-1)!.high;
  const minimumPrice = profile.bins[0].low;
  const closePosition = Math.max(0, Math.min(100, ((maximumPrice - close) / Math.max(maximumPrice - minimumPrice, 0.01)) * 100));
  const pocDistance = profile.pointOfControl === null ? null : (close / profile.pointOfControl - 1);

  return (
    <div className="volume-profile-card">
      <div className="profile-summary">
        <div><span>最密集成交区的中点</span><strong>约 {money(profile.pointOfControl)}</strong><small>样本中成交最多的价格区间</small></div>
        <div><span>主要成交区</span><strong>{money(profile.valueAreaLow)} — {money(profile.valueAreaHigh)}</strong><small>覆盖约70%成交量，不是持仓成本</small></div>
        <div><span>现价距最密集价</span><strong className={pocDistance !== null && pocDistance >= 0 ? "positive" : "negative"}>{pocDistance === null ? "—" : `${pocDistance >= 0 ? "+" : ""}${percent(pocDistance)}`}</strong><small>{profile.sessionCount} 个交易日 · {profile.barSize}数据</small></div>
      </div>
      <div className="volume-profile-chart" aria-label="按价格区间汇总的历史分钟成交量">
        <i className="profile-current-line" style={{ top: `${closePosition}%` }}><span>现价 {money(close)}</span></i>
        {[...profile.bins].reverse().map((bin) => {
          const isPoc = profile.pointOfControl !== null && Math.abs(bin.price - profile.pointOfControl) < (bin.high - bin.low) / 2;
          return (
            <div className={`profile-row ${bin.inValueArea ? "value-area" : ""} ${isPoc ? "poc" : ""}`} key={bin.low}>
              <span>{money(bin.price)}</span>
              <div><i style={{ width: `${Math.max(1, (bin.volume / maximumVolume) * 100)}%` }} /></div>
              <b>{(bin.volumePct * 100).toFixed(1)}%</b>
            </div>
          );
        })}
      </div>
      <div className="research-method-note"><b>怎么算</b>把最近 {profile.sessionCount} 个交易日的分钟成交量按价格区间归类。它只能说明哪些价格成交活跃，不能识别持有人、买卖方向或真实持仓成本。样本：{profile.sampleStart} 至 {profile.sampleEnd}，共 {profile.barCount.toLocaleString("zh-CN")} 根分钟柱。</div>
    </div>
  );
}
