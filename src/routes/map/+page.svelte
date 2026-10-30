<script lang="ts">
  import { onMount } from 'svelte';
  import type * as Leaflet from 'leaflet';
  import { loadLeaflet } from '#lib/client/map';
  import { t } from '#lib/i18n/index.svelte';
  import type { ReportDto } from '#lib/shared/types';

  let mapEl: HTMLDivElement | null = null;
  let map: Leaflet.Map | null = null;
  let reports = $state<ReportDto[]>([]);
  let loading = $state(true);
  let selected = $state<ReportDto | null>(null);

  onMount(async () => {
    // Leaflet nur im Browser laden (SSR-kompatibel), inkl. Icon-Fixes
    const L = await loadLeaflet();
    map = L.map(mapEl!).setView([51.1657, 10.4515], 6); // Deutschland-Zentrierung als Start
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    try {
      const res = await fetch('/api/reports?limit=200');
      const body = (await res.json()) as { reports: ReportDto[] };
      reports = body.reports;
      for (const r of reports) {
        const marker = L.marker([r.lat, r.lon]).addTo(map!);
        marker.on('click', () => (selected = r));
      }
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{t('nav_map')} – ProMA</title>
</svelte:head>

<h1>{t('nav_map')}</h1>

<div class="layout">
  <div bind:this={mapEl} class="map"></div>
  {#if !loading && reports.length === 0}
    <div class="empty">
      <p>{t('no_reports')}</p>
      <a href="/report" class="cta-link">{t('nav_report')}</a>
    </div>
  {/if}
  {#if selected}
    <aside>
      <button class="close" onclick={() => (selected = null)}>×</button>
      <img src={selected.image} alt={selected.title} />
      <h3>{selected.title}</h3>
      <p>{selected.description}</p>
      <p class="meta">
        {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)} · {t('score_label')}: {selected.score.toFixed(1)} ·
        👍 {selected.upvotes} 👎 {selected.downvotes}
        {#if selected.resolved}
          <span class="badge">{t('resolved_badge')}</span>
        {/if}
      </p>
    </aside>
  {/if}
</div>

<style>
  .layout {
    position: relative;
  }
  .map {
    height: 70vh;
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  aside {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: #fff;
    border-radius: 8px;
    padding: 1rem;
    width: 280px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
  }
  aside img {
    width: 100%;
    border-radius: 6px;
  }
  .close {
    position: absolute;
    top: 0.25rem;
    right: 0.5rem;
    border: none;
    background: none;
    font-size: 1.5rem;
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
  .empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem 2rem;
    text-align: center;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    z-index: 1001;
  }
  .empty p {
    margin: 0 0 0.75rem;
  }
  .cta-link {
    display: inline-block;
    background: #1a73e8;
    color: #fff;
    text-decoration: none;
    padding: 0.4rem 1rem;
    border-radius: 6px;
  }
</style>
