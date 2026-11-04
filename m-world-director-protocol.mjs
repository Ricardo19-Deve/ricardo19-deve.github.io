import {validateCharacterContext} from './m-world-character-context.mjs?v=30';
// Shared, data-only boundary for the optional automatic animation director.
// These suggestions never grant DOM access, navigation, coordinates or code.
export const DIRECTOR_ACTIONS = Object.freeze(['peek', 'perch', 'orbit', 'inspect', 'rest']);
export const DIRECTOR_GESTURES = Object.freeze(['none', 'wave', 'curious', 'surprised', 'shy', 'playful', 'wink', 'nod']);
export const DIRECTOR_EXPRESSIONS = Object.freeze(['neutral', 'happy', 'curious', 'surprised']);
export const DIRECTOR_KINDS = Object.freeze(['portrait', 'project', 'experience', 'expertise', 'certificate', 'contact', 'about']);
export const DIRECTOR_ZONES = Object.freeze(['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']);
export const DIRECTOR_EVENTS = Object.freeze(['idle', 'section-change', 'arrival', 'pointer-interest', 'tap']);
export const DIRECTOR_SECTIONS = Object.freeze(['none', 'home', 'hero', 'about', 'experience', 'projects', 'expertise', 'certifications', 'contact']);
export const DIRECTOR_MAX_TARGETS = 8;
export const DIRECTOR_MAX_RECENT = 6;

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function safeId(value) { return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/u.test(value); }
function title(value) { return typeof value === 'string' && value.trim().length > 0 && value.length <= 80 && !/[\u0000-\u001f\u007f]/u.test(value); }

export function validateDirectorInput(value) {
  if (!(exactKeys(value, ['snapshot']) || (exactKeys(value, ['snapshot','character']) && validateCharacterContext(value.character)))) return false;
  const snapshot = value.snapshot;
  if (!exactKeys(snapshot, ['revision', 'section', 'language', 'event', 'attentionId', 'targets', 'recent'])
    || !safeId(snapshot.revision) || !DIRECTOR_SECTIONS.includes(snapshot.section)
    || !['en', 'pt'].includes(snapshot.language) || !DIRECTOR_EVENTS.includes(snapshot.event)
    || !Array.isArray(snapshot.targets) || snapshot.targets.length > DIRECTOR_MAX_TARGETS
    || !Array.isArray(snapshot.recent) || snapshot.recent.length > DIRECTOR_MAX_RECENT) return false;
  const ids = new Set();
  for (const target of snapshot.targets) {
    if (!exactKeys(target, ['id', 'kind', 'title', 'actions', 'zone']) || !safeId(target.id)
      || ids.has(target.id) || !DIRECTOR_KINDS.includes(target.kind) || !title(target.title)
      || !DIRECTOR_ZONES.includes(target.zone) || !Array.isArray(target.actions)
      || target.actions.length < 1 || target.actions.length > DIRECTOR_ACTIONS.length
      || new Set(target.actions).size !== target.actions.length
      || !target.actions.every(action => DIRECTOR_ACTIONS.includes(action))) return false;
    ids.add(target.id);
  }
  return (snapshot.attentionId === null || ids.has(snapshot.attentionId))
    && snapshot.recent.every(item => exactKeys(item, ['targetId', 'action'])
      && DIRECTOR_ACTIONS.includes(item.action)
      && (safeId(item.targetId) || (item.targetId === null && item.action === 'rest')));
}

function inputOf(value) { return value?.snapshot && typeof value.snapshot === 'object' ? value : {snapshot:value}; }
function snapshotOf(value) { return inputOf(value).snapshot; }
export function validateDirectorReply(value, input) {
  const snapshot = snapshotOf(input);
  if (!validateDirectorInput(inputOf(input)) || !exactKeys(value, ['snapshot', 'targetId', 'action', 'gesture', 'expression'])
    || value.snapshot !== snapshot.revision || !DIRECTOR_ACTIONS.includes(value.action)
    || !DIRECTOR_GESTURES.includes(value.gesture) || !DIRECTOR_EXPRESSIONS.includes(value.expression)) return false;
  if (value.targetId === null) return value.action === 'rest';
  return snapshot.targets.some(target => target.id === value.targetId && target.actions.includes(value.action));
}

export function directorRest(input) {
  const snapshot = snapshotOf(input);
  return { snapshot: snapshot.revision, targetId: null, action: 'rest', gesture: 'none', expression: 'neutral' };
}

export function createDirectorSchema(input) {
  const snapshot = snapshotOf(input);
  if (!validateDirectorInput(inputOf(input))) throw new TypeError('Invalid director snapshot');
  return {
    type: 'object', additionalProperties: false,
    properties: {
      snapshot: { type: 'string', enum: [snapshot.revision] },
      targetId: { type: ['string', 'null'], enum: [...snapshot.targets.map(target => target.id), null] },
      action: { type: 'string', enum: [...new Set([...snapshot.targets.flatMap(target => target.actions), 'rest'])] },
      gesture: { type: 'string', enum: DIRECTOR_GESTURES },
      expression: { type: 'string', enum: DIRECTOR_EXPRESSIONS }
    },
    required: ['snapshot', 'targetId', 'action', 'gesture', 'expression']
  };
}