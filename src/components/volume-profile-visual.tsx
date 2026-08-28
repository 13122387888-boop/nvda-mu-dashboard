import { money, percent } from "@/lib/format";
import type { VolumeProfile } from "@/lib/indicators/volume-profile";

export function VolumeProfileVisual({ profile, close }: { profile: VolumeProfile; close: number }) {
  if (profile.status === "UNAVAILABLE" || !profile.bins.length) {
    return <div className="chart-empty">分钟成交数据暂不可用，无法生成成交量价格分布。</div>;
  }
  const maximumVolume = Math.max(...profile.bins.map((bin) => bin.volume), 1);
  const maximumPrice = profile.bins.at(-1)!.high;
  const minimumPrice = profile.bins[0].low;
  const closePosition = Math.max(0, Math.min(100, ((maximumPrice - close) / Math.max(maximumPrice - minimumPrice, 0.01)) * 100));
  const pocDistance = profile.pointOfControl === null ? null : (close / profile.pointOfControl - 1);

  return (
    <div className="volume-profile-card">
      <div className="profile-summary">
        <div><span>成交最密集价</span><strong>{money(profile.pointOfControl)}</strong><small>POC · 样本内成交量最大的价格区间</small></div>
        <div><span>70% 成交价值区</span><strong>{money(profile.valueAreaLow)} — {money(profile.valueAreaHigh)}</strong><small>不是股东真实持仓成本</small></div>
        <div><span>现价相对密集价</span><strong className={pocDistance !== null && pocDistance >= 0 ? "positive" : "negative"}>{pocDistance === null ? "—" : `${pocDistance >= 0 ? "+" : ""}${percent(pocDistance)}`}</strong><small>{profile.sessionCount} 个交易日 · {profile.barSize}数据</small></div>
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
      <div className="research-method-note"><b>口径</b>将最近 {profile.sessionCount} 个交易日的每分钟成交量归入该分钟典型价格所在区间。它反映“哪些价格成交活跃”，不能识别当前持有人、买卖方向或真实筹码成本。样本：{profile.sampleStart} 至 {profile.sampleEnd}，共 {profile.barCount.toLocaleString("zh-CN")} 根分钟柱。</div>
    </div>
  );
}
