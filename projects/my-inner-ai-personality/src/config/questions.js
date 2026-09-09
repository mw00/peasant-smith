// 10 questions, 5 per axis, A/B/C options. Each option carries a value on [-1,+1]
// for its axis. Convention: A maps toward the deterministic/controller pole,
// C toward the creative/liberal pole, B near-neutral (values may be slightly
// off-center so a mild lean still scores). Values are data-driven so questions
// can be edited without touching the scoring engine.

export const QUESTIONS = [
  // ---- Axis A: Creative ↔ Deterministic ----
  {
    id: 'A1',
    axis: 'creativity',
    text: 'When I make a decision, I rely on...',
    options: [
      { label: 'Facts and proven methods', value: -0.8 },
      { label: 'A mix of logic and instinct', value: -0.1 },
      { label: 'My intuition and imagination', value: 0.8 },
    ],
  },
  {
    id: 'A2',
    axis: 'creativity',
    text: "I'm most satisfied when my work is...",
    options: [
      { label: 'Consistent and reliable', value: -0.8 },
      { label: 'Good enough and balanced', value: 0 },
      { label: 'Original and surprising', value: 0.8 },
    ],
  },
  {
    id: 'A3',
    axis: 'creativity',
    text: 'My ideal day is...',
    options: [
      { label: 'A clear plan I execute', value: -0.8 },
      { label: 'A rough outline I adapt', value: 0 },
      { label: 'Open and spontaneous', value: 0.8 },
    ],
  },
  {
    id: 'A4',
    axis: 'creativity',
    text: 'When I tell a story, I tend to...',
    options: [
      { label: 'Stick to the facts', value: -0.8 },
      { label: 'Add some color', value: 0.1 },
      { label: 'Get creative with the details', value: 0.8 },
    ],
  },
  {
    id: 'A5',
    axis: 'creativity',
    text: 'I would rather...',
    options: [
      { label: 'Have one proven way', value: -0.6 },
      { label: 'Choose between a few good options', value: 0.2 },
      { label: 'Try many different ways', value: 0.7 },
    ],
  },
  // ---- Axis B: Controller ↔ Liberal ----
  {
    id: 'B1',
    axis: 'control',
    text: 'I prefer a response that is...',
    options: [
      { label: 'Short and to the point', value: -0.8 },
      { label: 'As long as it needs', value: 0.1 },
      { label: 'Rich and detailed', value: 0.7 },
    ],
  },
  {
    id: 'B2',
    axis: 'control',
    text: 'If I ask for help, I want...',
    options: [
      { label: 'Clear, strict instructions', value: -0.8 },
      { label: 'Some guidance, some freedom', value: 0 },
      { label: 'To figure it out myself', value: 0.7 },
    ],
  },
  {
    id: 'B3',
    axis: 'control',
    text: 'I get annoyed when...',
    options: [
      { label: 'Things get repetitive or off-topic', value: -0.8 },
      { label: 'Minor rambling, but it is fine', value: 0.1 },
      { label: "Nothing — I don't mind digressions", value: 0.7 },
    ],
  },
  {
    id: 'B4',
    axis: 'control',
    text: 'When instructions conflict with my preference, I...',
    options: [
      { label: 'Follow the instructions exactly', value: -0.7 },
      { label: 'Meet in the middle', value: 0.1 },
      { label: 'Push back and do it my way', value: 0.8 },
    ],
  },
  {
    id: 'B5',
    axis: 'control',
    text: 'When I plan something, I...',
    options: [
      { label: 'Set strict rules and boundaries', value: -0.7 },
      { label: 'Set flexible guidelines', value: 0.2 },
      { label: 'Leave everything open', value: 0.7 },
    ],
  },
]
