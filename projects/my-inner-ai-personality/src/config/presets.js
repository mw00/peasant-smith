// Quadrant config: labels, archetypes, colors, "best for" copy, and the
// per-client preset format strings. Colors are also used for the result card
// background/accent and the 2x2 grid squares.

// Quadrant keys follow sign(creativity), sign(control):
//   key = `${creativity >= 0 ? 'creative' : 'deterministic'}-${control >= 0 ? 'liberal' : 'controller'}`
// e.g. Q1 (Creative+Controller) = "creative-controller"

export const QUADRANTS = {
  'creative-controller': {
    id: 'Q1',
    label: 'The Imaginative Ruler',
    color: '#3B82F6', // blue
    archetype:
      'You like imaginative output but with guardrails — you want a model that explores and surprises without drifting off-brief or repeating itself. Ideal for creative writing that still follows a brief closely.',
    bestFor: 'Creative writing with a tight brief; marketing copy with guardrails; ad copy variations.',
    refParams: {
      temperature: '0.9 – 1.1',
      top_p: '~0.92',
      top_k: 60,
      repeat_penalty: '~1.2',
      frequency_penalty: 0.4,
      presence_penalty: 0.2,
      max_tokens: 1024,
    },
  },
  'creative-liberal': {
    id: 'Q2',
    label: 'The Free Spirit',
    color: '#8B5CF6', // purple
    archetype:
      'You want maximum freedom and imagination — let the model roam, explore wildly, and take risks. Low penalties and long outputs suit a brainstorming or fiction-first mindset.',
    bestFor: 'Brainstorming; fiction; open creative exploration; ideation sessions.',
    refParams: {
      temperature: '1.2 – 1.4',
      top_p: '~0.95',
      top_k: 80,
      repeat_penalty: '~1.1',
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: 2048,
    },
  },
  'deterministic-controller': {
    id: 'Q3',
    label: 'The Exact Engineer',
    color: '#EF4444', // red
    archetype:
      'You want precise, reproducible, on-topic output that follows instructions to the letter. Strong penalties and tight sampling make the model disciplined and factual — ideal for code, facts, and structured output.',
    bestFor: 'Code; factual Q&A; data extraction; structured/JSON output; anything that must be exact.',
    refParams: {
      temperature: '0.2 – 0.4',
      top_p: '~0.87',
      top_k: 40,
      repeat_penalty: '~1.25',
      frequency_penalty: 0.6,
      presence_penalty: 0.3,
      max_tokens: 512,
    },
  },
  'deterministic-liberal': {
    id: 'Q4',
    label: 'The Unconstrained Analyst',
    color: '#22C55E', // green
    archetype:
      'You want factual grounding but with room to breathe — long, thorough, detailed responses that stay accurate without being clipped short. Great for exhaustive analysis and research summaries.',
    bestFor: 'Exhaustive long-form analysis; research summaries; deep-dive reports where accuracy matters.',
    refParams: {
      temperature: '0.3 – 0.5',
      top_p: '~0.9',
      top_k: 60,
      repeat_penalty: '~1.1',
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: 2048,
    },
  },
}

// Default fallback when both axis scores are near neutral.
export const FALLBACK = {
  label: 'Balanced Generalist',
  color: '#6B7280', // gray
  archetype:
    'Your answers are balanced across both axes, so a well-rounded default preset works best — moderate temperature, relaxed penalties, and medium output length.',
  bestFor: 'General-purpose use; a safe starting point for most tasks.',
}

// per-client preset format notes (shown alongside the JSON block)
export const CLIENT_NOTES = [
  {
    client: 'Ollama',
    cmd: (p) =>
      `ollama run <model> --temp ${p.temperature} --top-p ${p.top_p} --top-k ${p.top_k} --repeat-penalty ${p.repeat_penalty}`,
  },
  {
    client: 'llama.cpp / llama-server',
    cmd: (p) =>
      `--temp ${p.temperature} --top-p ${p.top_p} --top-k ${p.top_k} --repeat-penalty ${p.repeat_penalty} --seed -1`,
  },
  {
    client: 'OpenAI API',
    cmd: () =>
      `send temperature, top_p, frequency_penalty, presence_penalty, max_tokens as request fields (top_k/seed not supported)`,
  },
]

// Animal mascot for each quadrant, used on the share card portrait.
// Q1 = creative-controller (blue)  -> Eagle        (vision + command)
// Q2 = creative-liberal  (purple)  -> Otter        (playful, free, clever)
// Q3 = deterministic-controller (red) -> Beaver    (the precision builder)
// Q4 = deterministic-liberal (green) -> Owl        (wise, analytical)
export const ANIMALS = {
  'creative-controller': { emoji: '🦅', name: 'Eagle' },
  'creative-liberal': { emoji: '🦦', name: 'Otter' },
  'deterministic-controller': { emoji: '🦫', name: 'Beaver' },
  'deterministic-liberal': { emoji: '🦉', name: 'Owl' },
}

// fallback for the neutral/balanced result
export const FALLBACK_ANIMAL = { emoji: '🦉', name: 'Owl' }
