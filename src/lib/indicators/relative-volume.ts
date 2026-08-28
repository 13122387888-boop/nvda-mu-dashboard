export type RelativeVolumePoint = {
  volume: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
};

export function relativeVolumeSeries(volumes: Array<number | null>, period = 20, minimumSamples = 10): RelativeVolumePoint[] {
  return volumes.map((volume, index) => {
    const prior = volumes
      .slice(Math.max(0, index - period), index)
      .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
    const averageVolume = prior.length >= minimumSamples ? prior.reduce((sum, value) => sum + value, 0) / prior.length : null;
    return {
      volume,
      averageVolume,
      relativeVolume: volume === null || averageVolume === null || averageVolume <= 0 ? null : volume / averageVolume,
    };
  });
}

export function latestRelativeVolume(volumes: Array<number | null>, period = 20) {
  return relativeVolumeSeries(volumes, period).at(-1) ?? { volume: null, averageVolume: null, relativeVolume: null };
}
