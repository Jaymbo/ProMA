// Text-Prüfung im Client: kleines Klassifikations-Modell (Transformers.js) + Regex-Fallback.
// Ziel: personenbezogene Inhalte (Namen, Verpetzung, Beleidigungen) VOR dem Upload abfangen.
import { browser } from '$app/env';

export interface TextCheckResult {
  ok: boolean;
  reason?: string;
  source: 'model' | 'rules' | 'none';
}

/** Regex-Regeln (identisch zur Server-Fallback-Logik) */
const BLOCKED_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(kennzeichen|kennz\.|nummernschild|fahrers?|personen?|leute|bewohner|nachbar[n]?|mieter|anwohner)\b/i,
    reason:
      'Die Meldung scheint Personen zu beschreiben. Bitte beschreibe nur die Situation, keine Personen (auch keine Kennzeichen).'
  },
  {
    re: /\b(idiot|dumm|verdamm|scheiß|hurensohn|arschloch|wichser|bastard|idiotin)\b/i,
    reason: 'Bitte bleibe sachlich — beleidigende Sprache ist nicht erlaubt.'
  },
  {
    re: /\b(herr|frau)\s+[A-ZÄÖÜ][a-zäöüß]+/,
    reason: 'Bitte keine Namen oder Anreden von Personen verwenden.'
  }
];

function ruleCheck(text: string): TextCheckResult | null {
  for (const { re, reason } of BLOCKED_PATTERNS) {
    if (re.test(text)) return { ok: false, reason, source: 'rules' };
  }
  return null;
}

let classifierPromise: Promise<((text: string) => Promise<Array<{ label: string; score: number }>>) | null> | null = null;

/**
 * Kleines Toxicity-Modell im Browser laden (~20 MB, gecached).
 * Gibt null zurück, wenn das Modell nicht verfügbar ist (alte Geräte) → Regel-Fallback.
 */
async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');
        env.allowLocalModels = false;
        return await pipeline('text-classification', 'Xenova/toxicity-detection', {
          quantized: true
        }) as unknown as (text: string) => Promise<Array<{ label: string; score: number }>>;
      } catch (err) {
        console.warn('Text-Modell nicht verfügbar, nutze Regel-Fallback:', err);
        return null;
      }
    })();
  }
  return classifierPromise;
}

export async function checkText(title: string, description: string): Promise<TextCheckResult> {
  const text = `${title}\n${description}`.trim();

  if (description.length < 10) {
    return {
      ok: false,
      reason: 'Bitte beschreibe das Problem etwas ausführlicher (min. 10 Zeichen).',
      source: 'rules'
    };
  }

  const rules = ruleCheck(text);
  if (rules) return rules;

  if (!browser) return { ok: true, source: 'none' };

  // KI-Prüfung (best effort — bei Fehler greifen die Regeln + Server-Fallback)
  try {
    const classify = await getClassifier();
    if (classify) {
      const results = await classify(text);
      const toxic = results.find((r) => r.label !== 'neutral' && r.score > 0.7);
      if (toxic) {
        return {
          ok: false,
          reason: 'Die Meldung enthält unangemessene Sprache. Bitte formuliere sachlich.',
          source: 'model'
        };
      }
    }
  } catch (err) {
    console.warn('KI-Prüfung fehlgeschlagen, Regeln haben bereits bestanden:', err);
  }

  return { ok: true, source: 'model' };
}
