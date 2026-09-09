// Two scoring axes. Each axis is scored independently on [-1, +1].
// Sign conventions:
//   creativity: -1 = Deterministic, +1 = Creative
//   control:    -1 = Controller,   +1 = Liberal

export const AXES = {
  creativity: {
    id: 'creativity',
    label: 'Creative ↔ Deterministic',
    creativeLabel: 'Creative',
    deterministicLabel: 'Deterministic',
  },
  control: {
    id: 'control',
    label: 'Controller ↔ Liberal',
    controllerLabel: 'Controller',
    liberalLabel: 'Liberal',
  },
}

export const AXIS_IDS = ['creativity', 'control']
