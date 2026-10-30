<script lang="ts">
  import { onMount } from 'svelte';
  import type * as Leaflet from 'leaflet';
  import { t } from '#lib/i18n/index.svelte';
  import type { ReportDto } from '#lib/shared/types';

  let mapEl: HTMLDivElement | null = null;
  let map: Leaflet.Map | null = null;
  let reports = $state<ReportDto[]>([]);
  let loading = $state(true);
  let selected = $state<ReportDto | null>(null);

  onMount(async () => {
    // Leaflet nur im Browser laden (SSR-kompatibel)
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

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

<h1>{t('nav_map')}</h1>

<div class="layout">
  <div bind:this={mapEl} class="map"></div>
  {#if selected}
    <aside>
      <button class="close" onclick={() => (selected = null)}>×</button>
      <img src={selected.image} alt={selected.title} />
      <h3>{selected.title}</h3>
      <p>{selected.description}</p>
      <p class="meta">
        {selected.area} · {t('score_label')}: {selected.score.toFixed(1)} ·
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
</style>
