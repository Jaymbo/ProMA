<script lang="ts">
  import { t } from '#lib/i18n/index.svelte';
  import { getClientId } from '#lib/client/identity';
  import { autoBlurFaces, applyManualBlurs } from '#lib/client/image';
  import { checkText } from '#lib/client/textcheck';

  let fileInput = $state<HTMLInputElement | null>(null);
  let originalFile: File | null = $state(null);
  let previewUrl: string | null = $state(null);
  let processedBlob: Blob | null = $state(null);
  let facesBlurred = $state(0);
  let modelUsed = $state(false);

  let title = $state('');
  let description = $state('');
  let area = $state('');
  let lat = $state<number | null>(null);
  let lon = $state<number | null>(null);
  let geoStatus = $state<'idle' | 'loading' | 'ok' | 'error'>('idle');

  let textCheck = $state<{ ok: boolean; reason?: string } | null>(null);
  let checking = $state(false);
  let submitting = $state(false);
  let rejectedReason = $state<string | null>(null);
  let success = $state(false);
  let errorMsg = $state<string | null>(null);

  // Blur-Rechtecke (manuell, für Kennzeichen), in Bild-Prozent
  type Region = { x: number; y: number; width: number; height: number };
  let blurRegions = $state<Region[]>([]);
  let drawingStart: { x: number; y: number } | null = null;

  async function onFileChange() {
    const file = fileInput?.files?.[0];
    if (!file) return;
    originalFile = file;
    previewUrl = URL.createObjectURL(file);
    blurRegions = [];
    facesBlurred = 0;
    modelUsed = false;
    processedBlob = null;
  }

  /** Gesichter automatisch verpixeln (Client, vor jedem Upload) */
  async function processPhoto() {
    if (!originalFile) return;
    checking = true;
    try {
      const result = await autoBlurFaces(originalFile);
      processedBlob = await applyManualBlurs(originalFile, blurRegions);
      facesBlurred = result.facesBlurred;
      modelUsed = result.modelUsed;
      if (result.facesBlurred > 0 && blurRegions.length === 0) {
        processedBlob = result.blob;
      }
      // Preview aktualisieren
      if (processedBlob) {
        previewUrl = URL.createObjectURL(processedBlob);
      }
    } catch (err) {
      console.error(err);
      errorMsg = t('error_generic');
    } finally {
      checking = false;
    }
  }

  function onPreviewMouseDown(e: MouseEvent) {
    const target = e.currentTarget as HTMLImageElement;
    const rect = target.getBoundingClientRect();
    drawingStart = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  }

  function onPreviewMouseUp(e: MouseEvent) {
    if (!drawingStart) return;
    const target = e.currentTarget as HTMLImageElement;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const width = Math.abs(x - drawingStart.x);
    const height = Math.abs(y - drawingStart.y);
    if (width > 1 && height > 1) {
      blurRegions = [
        ...blurRegions,
        {
          x: Math.min(drawingStart.x, x),
          y: Math.min(drawingStart.y, y),
          width,
          height
        }
      ];
    }
    drawingStart = null;
  }

  function useGps() {
    geoStatus = 'loading';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        geoStatus = 'ok';
      },
      () => {
        geoStatus = 'error';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /** Vor dem Veröffentlichen: Client-Prüfung + Bestätigungsdialog */
  async function submit() {
    errorMsg = null;
    rejectedReason = null;

    // 1. Text-Prüfung im Client (KI + Regeln)
    checking = true;
    const check = await checkText(title, description);
    checking = false;
    textCheck = check;
    if (!check.ok) {
      rejectedReason = check.reason ?? t('error_generic');
      return;
    }

    // 2. Foto verarbeiten (Gesichts-Blur)
    await processPhoto();
    if (!processedBlob) {
      errorMsg = t('error_generic');
      return;
    }

    // 3. Öffentlichkeits-Warnung mit Bestätigung
    const confirmed = confirm(
      `${t('report_preview_warning')}\n\n${t('report_privacy_note')}\n\n${t('report_submit')}?`
    );
    if (!confirmed) return;

    // 4. Upload
    submitting = true;
    try {
      const form = new FormData();
      form.set('title', title);
      form.set('description', description);
      form.set('area', area);
      form.set('lat', String(lat ?? 0));
      form.set('lon', String(lon ?? 0));
      form.set('image', new File([processedBlob], 'photo.jpg', { type: 'image/jpeg' }));

      const res = await fetch('/api/reports', { method: 'POST', body: form });
      if (res.status === 422) {
        const body = (await res.json()) as { reason?: string };
        rejectedReason = body.reason ?? t('error_generic');
        return;
      }
      if (!res.ok) {
        errorMsg = (await res.text()) || t('error_generic');
        return;
      }
      success = true;
    } catch {
      errorMsg = t('error_generic');
    } finally {
      submitting = false;
    }
  }
</script>

<h1>{t('report_title')}</h1>

{#if success}
  <p class="success">{t('report_success')}</p>
  <a href="/">{t('nav_list')}</a>
{:else}
  <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
    <label>
      {t('report_photo')}
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" bind:this={fileInput} onchange={onFileChange} required />
    </label>
    <p class="hint">{t('report_photo_hint')}</p>

    {#if previewUrl}
      <div class="preview-wrap">
        <img
          src={previewUrl}
          alt="Vorschau"
          onmousedown={onPreviewMouseDown}
          onmouseup={onPreviewMouseUp}
        />
        <div class="blur-overlay">
          {#each blurRegions as r}
            <div class="blur-rect" style="left:{r.x}%; top:{r.y}%; width:{r.width}%; height:{r.height}%"></div>
          {/each}
        </div>
      </div>
      <p class="hint">
        {facesBlurred > 0
          ? `${facesBlurred} Gesicht(er) automatisch verpixelt${modelUsed ? '' : ' (Modell nicht verfügbar)'}.`
          : 'Tipp: Zum Verpixeln von Kennzeichen ein Rechteck auf dem Foto aufziehen.'}
      </p>
      <button type="button" onclick={processPhoto} disabled={checking}>
        {checking ? t('report_submit_checking') : 'Gesichter verpixeln / Vorschau aktualisieren'}
      </button>
    {/if}

    <label>
      {t('report_title_label')}
      <input type="text" maxlength="120" bind:value={title} placeholder={t('report_title_placeholder')} required />
    </label>

    <label>
      {t('report_desc_label')}
      <textarea maxlength="2000" rows="4" bind:value={description} placeholder={t('report_desc_placeholder')} required></textarea>
    </label>

    <fieldset>
      <legend>{t('report_location')}</legend>
      <button type="button" onclick={useGps} disabled={geoStatus === 'loading'}>
        {geoStatus === 'loading' ? '…' : t('report_location_auto')}
      </button>
      {#if geoStatus === 'ok'}
        <p class="hint">GPS: {lat?.toFixed(5)}, {lon?.toFixed(5)}</p>
      {:else if geoStatus === 'error'}
        <p class="error">{t('geolocation_error')}</p>
      {/if}
      <label>
        {t('report_area')}
        <input type="text" maxlength="80" bind:value={area} placeholder={t('report_area_placeholder')} required />
      </label>
    </fieldset>

    {#if rejectedReason}
      <p class="error"><strong>{t('report_rejected')}</strong> {rejectedReason}</p>
    {/if}
    {#if errorMsg}
      <p class="error">{errorMsg}</p>
    {/if}

    <div class="warning">{t('report_preview_warning')}</div>

    <button type="submit" disabled={submitting || checking}>
      {submitting || checking ? t('report_submit_checking') : t('report_submit')}
    </button>
  </form>
{/if}

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 600px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  input[type='text'],
  textarea {
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .preview-wrap {
    position: relative;
    max-width: 400px;
  }
  .preview-wrap img {
    width: 100%;
    display: block;
    cursor: crosshair;
  }
  .blur-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .blur-rect {
    position: absolute;
    background: rgba(128, 128, 128, 0.4);
    border: 1px dashed #555;
    backdrop-filter: blur(8px);
  }
  .warning {
    background: var(--warning-bg);
    border: 1px solid var(--warning-border);
    border-radius: 6px;
    padding: 0.75rem;
    font-weight: 600;
  }
  .error {
    color: var(--danger);
  }
  .success {
    color: #188038;
    font-weight: 600;
  }
  .hint {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
