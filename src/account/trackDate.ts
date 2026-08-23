import type { GpxTrack } from './types';

type TrackDateFields = Pick<GpxTrack, 'started_at' | 'ready_at' | 'created_at'>;

const trackDateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function getTrackDateIso(track: TrackDateFields): string {
  return track.started_at ?? track.ready_at ?? track.created_at;
}

export function formatTrackDate(track: TrackDateFields): string {
  return trackDateFormatter.format(new Date(getTrackDateIso(track)));
}