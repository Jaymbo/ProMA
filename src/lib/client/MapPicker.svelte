<script lang="ts">
  import { onMount } from 'svelte';
  import type * as Leaflet from 'leaflet';
  import { loadLeaflet } from '#lib/client/map';
  import { t } from '#lib/i18n/index.svelte';

  let {
    lat = $bindable(null),
    lon = $bindable(null),
    height = 320
  }: { lat?: number | null; lon?: number | null; height?: number } = $props();

  let mapEl = $state<HTMLDivElement | null>(null);
  let map: Leaflet.Map | null = null;
  let marker: Leaflet.Marker | null = null;
  let L: typeof Leaflet | null = null;

  let cleanupFn: (() => void) | null = null;

  onMount(() => {
    void initMap();
    return () => cleanupFn?.();
  });

  async function initMap() {
    L = await loadLeaflet();
    if (!mapEl) return;
    map = L.map(mapEl).setView([51.1657, 10.4515], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    map.on('click', (e: Leaflet.LeafletMouseEvent) => setMarker(e.latlng.lat, e.latlng.lng));

    // Falls GPS/Koordinaten schon gesetzt sind: Marker anzeigen + hinzoomen
    if (lat !== null && lon !== null) {
      setMarker(lat, lon);
      map.setView([lat, lon], 15);
    }

    cleanupFn = () => {
      map?.remove();
      map = null;
      marker = null;
    };
  }

  // Externe lat/lon-Änderung (z. B. GPS-Button): Marker setzen + hinfliegen
  $effect(() => {
    if (map && L && lat !== null && lon !== null) {
      const p = marker?.getLatLng();
      const isOwnUpdate = p && p.lat === lat && p.lng === lon;
      if (!isOwnUpdate) {
        setMarker(lat, lon);
        map.flyTo([lat, lon], 15);
      }
    }
  });

  function setMarker(newLat: number, newLon: number) {
    lat = newLat;
    lon = newLon;
    if (marker) {
      marker.setLatLng([newLat, newLon]);
    } else {
      marker = L!.marker([newLat, newLon], { draggable: true }).addTo(map!);
      marker.on('dragend', () => {
        const p = marker!.getLatLng();
        lat = p.lat;
        lon = p.lng;
      });
    }
  }

  /** Von außen aufrufbar: auf aktuellen Marker zoomen */
  export function flyTo(latVal: number, lonVal: number): void {
    map?.flyTo([latVal, lonVal], 15);
  }
</script>

<div bind:this={mapEl} class="pick-map" style="height:{height}px"></div>
<p class="hint">
  {#if lat !== null && lon !== null}
    {t('report_location_set')} {lat.toFixed(5)}, {lon.toFixed(5)}
  {:else}
    {t('report_location_pick')}
  {/if}
</p>

<style>
  .pick-map {
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .hint {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0.25rem 0 0;
  }
</style>
