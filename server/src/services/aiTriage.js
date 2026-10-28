import { z } from 'zod';
import { env } from '../config/env.js';
import {
  CATEGORY_KEYWORDS,
  CATEGORY_MAP,
  CATEGORY_KEYS,
  DEFAULT_SLA_HOURS,
  PRIORITY_TIERS,
  URGENCY_KEYWORDS,
  VULNERABILITY_KEYWORDS,
} from '../config/constants.js';
import { duplicateScore } from '../utils/similarity.js';

const RULE_ENGINE = 'rule-based-fallback';
const RULE_MODEL = 'grievanceai-heuristics-v1';

export const triageSchema = z.object({
  category: z.enum(CATEGORY_KEYS),
  subCategory: z.string().max(120).default(''),
  severity: z.number().int().min(1).max(4),
  priority: z.enum(Object.values(PRIORITY_TIERS)),
  departmentCode: z.string().max(24).default(''),
  slaHours: z.number().min(1).max(720),
  summary: z.string().min(1).max(600),
  nextSteps: z.array(z.string().max(240)).max(8).default([]),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'distressed']).default('neutral'),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(600).default(''),
});

export function normaliseTriage(input) {
  const parsed = triageSchema.parse(input);
  return {
    ...parsed,
    // Deterministic tier↔severity consistency guard so a provider can never
    // return a "Critical" label with a 72h SLA, etc.
    priority: parsed.priority,
    slaHours: parsed.slaHours,
  };
}

export function isProviderConfigured() {
  const { provider, openaiKey, anthropicKey, geminiKey } = env.ai;
  if (provider === 'openai') return Boolean(openaiKey);
  if (provider === 'anthropic') return Boolean(anthropicKey);
  if (provider === 'gemini') return Boolean(geminiKey);
  return false;
}

export function engineStatus() {
  const configured = isProviderConfigured();
  return {
    configured,
    provider: configured ? env.ai.provider : 'none',
    engine: configured ? `${env.ai.provider}-llm` : RULE_ENGINE,
    model: configured ? env.ai.model || defaultModelFor(env.ai.provider) : RULE_MODEL,
    fallbackAvailable: true,
    note: configured
      ? 'Live AI provider configured. Outputs are validated before use.'
      : 'No AI provider configured. Triage uses the explicitly labelled rule-based fallback engine.',
  };
}

function defaultModelFor(provider) {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku-latest';
    case 'gemini':
      return 'gemini-1.5-flash';
    default:
      return 'none';
  }
}

/* -------------------------------------------------------------------------- */
/*                              Rule-based engine                             */
/* -------------------------------------------------------------------------- */

function scoreCategories(text) {
  const scores = {};
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score += kw.includes(' ') ? 2 : 1;
    }
    if (score > 0) scores[category] = score;
  }
  return scores;
}

function detectSentiment(text) {
  const urgency = URGENCY_KEYWORDS.filter((k) => text.includes(k)).length;
  const distress = ['chest pain', 'breathless', 'unconscious', 'bleeding', 'emergency', 'sos'];
  if (distress.some((k) => text.includes(k))) return 'distressed';
  if (urgency >= 2) return 'negative';
  if (urgency === 1) return 'negative';
  const positive = ['thank', 'appreciate', 'excellent', 'good service'];
  if (positive.some((k) => text.includes(k))) return 'positive';
  return 'neutral';
}

/**
 * Deterministic keyword/heuristic triage. This is what runs when no AI provider
 * is configured — it is labelled as such everywhere it surfaces and never
 * pretends to be an LLM.
 */
export function ruleBasedTriage({ subject = '', description = '', meta = {} }) {
  const text = `${subject} ${description}`.toLowerCase();
  const scores = scoreCategories(text);

  let category = 'other';
  if (Object.keys(scores).length) {
    category = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  } else if (meta.categoryHint && CATEGORY_MAP[meta.categoryHint]) {
    category = meta.categoryHint;
  }
  const catDef = CATEGORY_MAP[category];

  const urgencyHits = URGENCY_KEYWORDS.filter((k) => text.includes(k));
  const vulnerabilityHits = VULNERABILITY_KEYWORDS.filter((k) => text.includes(k));

  let severity = 2;
  if (['medical', 'safety'].includes(category)) severity = 4;
  else if (urgencyHits.length >= 3) severity = 4;
  else if (urgencyHits.length >= 1 || catDef.defaultTier === PRIORITY_TIERS.TIER2) severity = 3;
  // A vulnerable passenger raises the floor but never alone implies a
  // life-threatening escalation (that is reserved for medical/safety cases).
  if (vulnerabilityHits.length && severity < 3) severity += 1;
  severity = Math.min(4, Math.max(1, severity));

  const priority =
    severity >= 4 ? PRIORITY_TIERS.TIER1 : severity === 3 ? PRIORITY_TIERS.TIER2 : PRIORITY_TIERS.TIER3;

  const slaHours = DEFAULT_SLA_HOURS[priority];
  const matchCount = Object.keys(scores).length;
  const confidence = Math.min(0.93, 0.45 + matchCount * 0.08 + urgencyHits.length * 0.03);

  const nextSteps = [
    `Route case to ${catDef.label} wing for verification.`,
    priority === PRIORITY_TIERS.TIER1
      ? 'Trigger immediate duty-officer dispatch and DRM escalation watch.'
      : 'Assign to the on-duty section engineer within the SLA window.',
    'Capture field evidence (photo/telemetry) before closure.',
  ];

  const summaryParts = [subject.trim() || catDef.label];
  if (meta.trainNumber) summaryParts.push(`on train ${meta.trainNumber}`);
  if (meta.coach) summaryParts.push(`coach ${meta.coach}`);
  const summary = `${catDef.label}: ${summaryParts.join(' ')}`.slice(0, 600);

  return normaliseTriage({
    category,
    subCategory: catDef.description.split(',')[0] || '',
    severity,
    priority,
    departmentCode: catDef.defaultDepartment,
    slaHours,
    summary,
    nextSteps,
    sentiment: detectSentiment(text),
    confidence: Number(confidence.toFixed(2)),
    notes: `Rule-based keyword triage matched ${matchCount} category signal(s)${
      urgencyHits.length ? ` and ${urgencyHits.length} urgency term(s)` : ''
    }.`,
  });
}

/* -------------------------------------------------------------------------- */
/*                                LLM providers                               */
/* -------------------------------------------------------------------------- */

function buildPrompt({ subject, description, meta }) {
  return `You are the triage engine for a passenger grievance redressal system.
Classify the grievance and reply with ONLY a JSON object (no markdown fences) using this schema:
{
  "category": one of ${JSON.stringify(CATEGORY_KEYS)},
  "subCategory": string,
  "severity": integer 1-4 (1 minor, 4 critical/life-threatening),
  "priority": "tier1" | "tier2" | "tier3",
  "departmentCode": short uppercase code such as ELEC, MECH, OBHS, SEC, COMM, MED, OPS,
  "slaHours": number of hours the case should be resolved within,
  "summary": one-sentence neutral summary (max 300 chars),
  "nextSteps": array of 2-5 short operational next steps,
  "sentiment": "positive" | "neutral" | "negative" | "distressed",
  "confidence": number between 0 and 1,
  "notes": short rationale
}

Context: ${JSON.stringify(meta || {})}
Subject: ${subject}
Description: ${description}`;
}

async function withTimeout(promiseFactory) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ai.timeoutMs);
  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw) {
  const text = String(raw).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in provider response');
  return JSON.parse(text.slice(start, end + 1));
}

async function callOpenAI(prompt) {
  return withTimeout(async (signal) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.ai.openaiKey}`,
      },
      body: JSON.stringify({
        model: env.ai.model || defaultModelFor('openai'),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You output only valid JSON for grievance triage.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  });
}

async function callAnthropic(prompt) {
  return withTimeout(async (signal) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ai.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ai.model || defaultModelFor('anthropic'),
        max_tokens: 1024,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  });
}

async function callGemini(prompt) {
  const model = env.ai.model || defaultModelFor('gemini');
  return withTimeout(async (signal) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.ai.geminiKey}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  });
}

const PROVIDER_CALLERS = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  gemini: callGemini,
};

/* -------------------------------------------------------------------------- */
/*                              Public entrypoint                             */
/* -------------------------------------------------------------------------- */

/**
 * Runs triage for a grievance. Always returns a validated triage object.
 *
 * When a provider is configured and succeeds, the result is tagged with the
 * real provider/model. On any failure (or when unconfigured) it transparently
 * degrades to the rule-based fallback and records why in `notes`.
 *
 * @param {object} payload
 * @param {Array}  payload.duplicatePool - existing grievances to compare against
 */
export async function triageGrievance(payload, { duplicatePool = [] } = {}) {
  const { subject = '', description = '', meta = {} } = payload;
  let triage;
  let fellBack = false;
  let fallbackReason = '';

  if (isProviderConfigured()) {
    const caller = PROVIDER_CALLERS[env.ai.provider];
    try {
      const raw = await caller(buildPrompt({ subject, description, meta }));
      const validated = normaliseTriage(extractJson(raw));
      triage = {
        ...validated,
        engine: `${env.ai.provider}-llm`,
        provider: env.ai.provider,
        model: env.ai.model || defaultModelFor(env.ai.provider),
      };
    } catch (err) {
      fellBack = true;
      fallbackReason = `AI provider "${env.ai.provider}" failed (${err.message}); degraded to rule-based engine.`;
    }
  }

  if (!triage) {
    triage = { ...ruleBasedTriage({ subject, description, meta }), engine: RULE_ENGINE, provider: 'rule-based', model: RULE_MODEL };
    if (!env.ai.provider || env.ai.provider === 'none') {
      fallbackReason = 'No AI provider configured; using rule-based engine.';
      fellBack = true;
    }
  }

  const duplicates = findDuplicates(
    { subject, description, ...meta },
    duplicatePool
  );

  return {
    ...triage,
    notes: fellBack && fallbackReason ? `${fallbackReason} ${triage.notes || ''}`.trim() : triage.notes,
    duplicateCandidates: duplicates,
    degraded: fellBack,
  };
}

/**
 * Deterministic duplicate candidate detection — never faked, always computed
 * from real stored grievances.
 */
export function findDuplicates(source, pool = [], threshold = 0.35) {
  return pool
    .map((candidate) => ({
      grievance: candidate._id,
      referenceId: candidate.referenceId,
      score: duplicateScore(source, candidate),
      reason: `Lexical overlap with ${candidate.referenceId}`,
    }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export { RULE_ENGINE, RULE_MODEL };
