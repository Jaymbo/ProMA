// Anonyme Client-ID: zufällige UUID im localStorage, keine personenbezogenen Daten.
import { browser } from '$app/env';

const CLIENT_ID_KEY = 'proma_client_id';

export function getClientId(): string {
  if (!browser) return 'server';
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

/** Lokale Vote-Sperre (erste Hürde, serverseitig kommt IP-Hash dazu) */
const VOTED_KEY = 'proma_voted';

export function getLocalVotes(): Record<string, number> {
  if (!browser) return {};
  try {
    return JSON.parse(localStorage.getItem(VOTED_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function rememberLocalVote(reportId: number, value: number): void {
  if (!browser) return;
  const votes = getLocalVotes();
  votes[String(reportId)] = value;
  localStorage.setItem(VOTED_KEY, JSON.stringify(votes));
}

export function hasLocalVote(reportId: number): number | undefined {
  return getLocalVotes()[String(reportId)];
}
