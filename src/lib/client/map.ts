// Gemeinsames Leaflet-Modul: lädt Leaflet + CSS nur im Browser und
// repariert die Default-Marker-Icons (Bundler zerlegt sonst die Asset-URLs).
import type * as LeafletNS from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let leafletPromise: Promise<typeof LeafletNS> | null = null;

export function loadLeaflet(): Promise<typeof LeafletNS> {
  if (!leafletPromise) {
    leafletPromise = (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Default-Icons auf gebundelte Assets umbiegen
      const icon = L.Icon.Default.prototype as unknown as { _getIconUrl?: (name: string) => string };
      delete icon._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow
      });

      return L;
    })();
  }
  return leafletPromise;
}
