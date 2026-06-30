// Colorful card themes for goals + ready-made suggestions, shared by the
// backend (seed/create defaults) and the frontend (quick-add chips).

export const GOAL_THEMES = [
  { accent: '#FF8A3D', bg: 'linear-gradient(120deg,#FFF1E6,#FFE4D1)', border: '#ffd9be' }, // orange
  { accent: '#2B8FE0', bg: 'linear-gradient(120deg,#E7F7FF,#D4EEFF)', border: '#bfe4fb' }, // blue
  { accent: '#1FAE63', bg: 'linear-gradient(120deg,#EAFBF1,#D6F5E2)', border: '#c0eecf' }, // green
  { accent: '#A78BFA', bg: 'linear-gradient(120deg,#F4ECFF,#E9DBFF)', border: '#ddc9fb' }, // purple
  { accent: '#FF6FA5', bg: 'linear-gradient(120deg,#FFE9F1,#FFD6E6)', border: '#ffc2d8' }, // pink
];

export const goalThemeAt = (i) => GOAL_THEMES[((i % GOAL_THEMES.length) + GOAL_THEMES.length) % GOAL_THEMES.length];

// One-tap suggestions. `theme` indexes GOAL_THEMES; `target` is a sensible
// default the user can adjust. Indian context, ₹ amounts.
export const GOAL_SUGGESTIONS = [
  { emoji: '🛟', name: 'Emergency fund', target: 300000, theme: 2 },
  { emoji: '✈️', name: 'Vacation', target: 80000, theme: 1 },
  { emoji: '🏍️', name: 'New bike', target: 150000, theme: 0 },
  { emoji: '📱', name: 'New phone', target: 80000, theme: 3 },
  { emoji: '🚗', name: 'New car', target: 800000, theme: 1 },
  { emoji: '🏠', name: 'Home down payment', target: 2000000, theme: 4 },
  { emoji: '💍', name: 'Wedding', target: 1000000, theme: 4 },
  { emoji: '🎓', name: 'Education', target: 500000, theme: 3 },
  { emoji: '💻', name: 'New laptop', target: 120000, theme: 0 },
  { emoji: '🎁', name: 'Festive savings', target: 50000, theme: 0 },
];

// Emoji palette for the goal editor's picker.
export const GOAL_EMOJIS = ['🎯', '🛟', '✈️', '🏍️', '🚗', '🏠', '📱', '💻', '🎓', '💍', '🎁', '💰', '🏖️', '⌚', '🐶', '👶', '🏥', '📷'];
