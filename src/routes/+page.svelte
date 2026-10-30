<script lang="ts">
  import { t } from '#lib/i18n/index.svelte';
  import { getClientId, hasLocalVote, rememberLocalVote } from '#lib/client/identity';
  import type { ReportDto } from '#lib/shared/types';

  let reports = $state<ReportDto[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let sort = $state<'score' | 'new' | 'votes'>('score');
  let openOnly = $state(true);

  async function load() {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams();
      params.set('sort', sort);
      if (openOnly) params.set('resolved', 'false');
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { reports: ReportDto[] };
      reports = body.reports;
    } catch {
      error = t('error_generic');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Neu laden, sobald sich ein Filter ändert
    void sort;
    void openOnly;
    load();
  });

  async function vote(report: ReportDto, value: 1 | -1) {
    if (hasLocalVote(report.id) !== undefined) return; // schon gevotet (lokal)
    try {
      const res = await fetch(`/api/reports/${report.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, client_id: getClientId() })
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { changed: boolean };
      if (body.changed) {
        rememberLocalVote(report.id, value);
        if (value === 1) report.upvotes++;
        else report.downvotes++;
      }
    } catch {
      error = t('error_generic');
    }
  }

  async function flag(report: ReportDto) {
    const reason = prompt(t('flag_reason_prompt')) ?? '';
    if (reason === null) return;
    try {
      const res = await fetch(`/api/reports/${report.id}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: getClientId(), reason })
      });
      if (!res.ok) throw new Error();
      alert(t('flag_success'));
      await load();
    } catch {
      error = t('error_generic');
    }
  }

  async function confirmResolve(report: ReportDto) {
    try {
      const res = await fetch(`/api/reports/${report.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: getClientId() })
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { confirmations: number; threshold: number; resolved: boolean };
      alert(
        body.resolved
          ? t('resolved_badge')
          : `${body.confirmations}/${body.threshold} Bestätigungen`
      );
      await load();
    } catch {
      error = t('error_generic');
    }
  }
</script>

<h1>{t('list_title')}</h1>

<div class="filters">
  <label class="checkbox">
    <input type="checkbox" bind:checked={openOnly} />
    {t('filter_open')}
  </label>
  <select bind:value={sort}>
    <option value="score">{t('sort_score')}</option>
    <option value="new">{t('sort_new')}</option>
    <option value="votes">{t('sort_votes')}</option>
  </select>
</div>

{#if loading}
  <p>{t('loading')}</p>
{:else if error}
  <p class="error">{error}</p>
{:else if reports.length === 0}
  <p>{t('no_reports')}</p>
{:else}
  <ul class="reports">
    {#each reports as report (report.id)}
      <li class:resolved={report.resolved}>
        <img src={report.image} alt={report.title} loading="lazy" />
        <div class="body">
          <h3>{report.title}</h3>
          <p>{report.description}</p>
          <p class="meta">
            {report.lat.toFixed(4)}, {report.lon.toFixed(4)} ·
            {new Date(report.created_at + 'Z').toLocaleString()} ·
            {t('score_label')}: {report.score.toFixed(1)}
            {#if report.resolved}
              <span class="badge">{t('resolved_badge')}</span>
            {/if}
          </p>
          <div class="actions">
            <button onclick={() => vote(report, 1)} disabled={report.resolved || hasLocalVote(report.id) !== undefined}>
              👍 {report.upvotes} · {t('vote_up')}
            </button>
            <button onclick={() => vote(report, -1)} disabled={report.resolved || hasLocalVote(report.id) !== undefined}>
              👎 {report.downvotes} · {t('vote_down')}
            </button>
            {#if !report.resolved}
              <button onclick={() => confirmResolve(report)}>✅ {t('vote_done')}</button>
            {/if}
            <button class="flag" onclick={() => flag(report)}>🚩 {t('flag_button')}</button>
          </div>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .filters {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .filters input[type='text'] {
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    min-width: 200px;
  }
  .reports {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .reports li {
    display: flex;
    gap: 1rem;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem;
  }
  .reports li.resolved {
    opacity: 0.6;
  }
  .reports img {
    width: 160px;
    height: 120px;
    object-fit: cover;
    border-radius: 6px;
  }
  .body {
    flex: 1;
  }
  .body h3 {
    margin: 0 0 0.25rem;
  }
  .meta {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .badge {
    background: #188038;
    color: #fff;
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-size: 0.8rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .actions button {
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #fff;
  }
  .actions button.flag {
    color: var(--danger);
  }
  .error {
    color: var(--danger);
  }
</style>
