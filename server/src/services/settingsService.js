import { Setting } from '../models/Setting.js';
import { CATEGORIES, DEFAULT_SLA_HOURS, SETTING_KEYS } from '../config/constants.js';

const DEFAULTS = {
  [SETTING_KEYS.SLA_RULES]: {
    tier1: DEFAULT_SLA_HOURS.tier1,
    tier2: DEFAULT_SLA_HOURS.tier2,
    tier3: DEFAULT_SLA_HOURS.tier3,
  },
  [SETTING_KEYS.CATEGORY_TAXONOMY]: CATEGORIES,
  [SETTING_KEYS.AI_CONFIG]: {
    autoTriage: true,
    officerOverrideAllowed: true,
    duplicateDetection: true,
    confidenceThreshold: 0.6,
  },
  [SETTING_KEYS.NOTIFICATION_RULES]: {
    onStatusChange: true,
    onAssignment: true,
    onMessage: true,
    onSlaBreach: true,
    slaWarningMinutes: 30,
  },
  [SETTING_KEYS.GENERAL]: {
    organisation: 'GrievanceAI Transit Redressal Authority',
    timezone: 'Asia/Kolkata',
    defaultLanguage: 'en',
    dualOtpEnforced: true,
  },
};

export async function getSetting(key) {
  const doc = await Setting.findOne({ key }).lean();
  return doc ? doc.value : DEFAULTS[key];
}

export async function getAllSettings() {
  const docs = await Setting.find({}).lean();
  const map = { ...DEFAULTS };
  for (const doc of docs) map[doc.key] = doc.value;
  return map;
}

export async function setSetting(key, value, userId = null) {
  return Setting.findOneAndUpdate(
    { key },
    { key, value, updatedBy: userId },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function getSlaRules() {
  return { ...DEFAULTS[SETTING_KEYS.SLA_RULES], ...(await getSetting(SETTING_KEYS.SLA_RULES)) };
}

export { DEFAULTS as DEFAULT_SETTINGS };
