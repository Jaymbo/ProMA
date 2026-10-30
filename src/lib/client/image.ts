// Bildverarbeitung im Client: Gesichts-Blur (BlazeFace via TensorFlow.js) + manuelles Blur.
// Modelle laufen komplett im Browser — der Server sieht nur das fertige, anonymisierte Bild.
import { browser } from '$app/env';
import type { NormalizedFace } from '@tensorflow-models/blazeface';

export interface BlurResult {
  blob: Blob;
  facesBlurred: number;
  modelUsed: boolean;
}

let faceDetectorPromise: Promise<Detector | null> | null = null;

interface Detector {
  estimateFaces(
    input: HTMLCanvasElement,
    returnTensors?: boolean,
    flipHorizontal?: boolean,
    annotateBoxes?: boolean
  ): Promise<NormalizedFace[]>;
}

/** BlazeFace-Modell lazy laden (~1–2 MB), nur im Browser. null = nicht verfügbar (Fallback). */
async function getFaceDetector(): Promise<Detector | null> {
  if (!browser) return null;
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      try {
        await import('@tensorflow/tfjs');
        const blazeface = await import('@tensorflow-models/blazeface');
        const model = await blazeface.load({ maxFaces: 10 });
        return model as unknown as Detector;
      } catch (err) {
        console.warn('BlazeFace konnte nicht geladen werden:', err);
        return null;
      }
    })();
  }
  return faceDetectorPromise;
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** Rechteck weichzeichnen */
function blurRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  strength = 12
): void {
  ctx.save();
  ctx.filter = `blur(${strength}px)`;
  ctx.drawImage(ctx.canvas, x, y, w, h, x, y, w, h);
  ctx.restore();
}

function faceBox(face: NormalizedFace): { x: number; y: number; w: number; h: number } {
  const [tx, ty] = face.topLeft as [number, number];
  const [bx, by] = face.bottomRight as [number, number];
  return { x: tx, y: ty, w: bx - tx, h: by - ty };
}

/**
 * Foto verarbeiten: erkannte Gesichter automatisch verpixeln.
 * Fallback: wenn das Modell nicht lädt (alte Geräte), wird das Original zurückgegeben.
 */
export async function autoBlurFaces(file: File): Promise<BlurResult> {
  const img = await fileToImage(file);
  const canvas = imageToCanvas(img);

  let facesBlurred = 0;
  let modelUsed = false;
  const detector = await getFaceDetector();
  if (detector) {
    try {
      const faces = await detector.estimateFaces(canvas, false);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas nicht verfügbar');
      modelUsed = true;
      for (const face of faces) {
        const { x, y, w, h } = faceBox(face);
        const pad = w * 0.15;
        blurRect(ctx, Math.max(0, x - pad), Math.max(0, y - pad), w + 2 * pad, h + 2 * pad, 14);
        facesBlurred++;
      }
    } catch (err) {
      console.warn('Gesichtserkennung fehlgeschlagen:', err);
    }
  }

  return { blob: await canvasToBlob(canvas), facesBlurred, modelUsed };
}

/** Manuelles Blur-Rechteck auf das Bild anwenden (für Kennzeichen etc.). Koordinaten in Prozent. */
export async function applyManualBlurs(
  file: File,
  regions: Array<{ x: number; y: number; width: number; height: number }>
): Promise<Blob> {
  const img = await fileToImage(file);
  const canvas = imageToCanvas(img);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  for (const r of regions) {
    blurRect(
      ctx,
      (r.x / 100) * canvas.width,
      (r.y / 100) * canvas.height,
      (r.width / 100) * canvas.width,
      (r.height / 100) * canvas.height,
      16
    );
  }
  return canvasToBlob(canvas);
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild konnte nicht geladen werden'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Blob-Erzeugung fehlgeschlagen'))),
      'image/jpeg',
      0.85
    );
  });
}
