---
name: goals-feature
description: Goals are now a real user-owned `goals` collection (CRUD + contribute + quick-add suggestions), no longer static Discover content
metadata:
  type: project
---

Goals converted from static curated content to **real user-owned data**. User-approved data-model addition (the documented M1 collections did not include goals).

**New `goals` collection** (`src/modules/goals/goal.model.js`): userId, name, emoji, target, saved (default 0), accent/bg/border (card theme persisted on create), order, isActive (soft-delete). Progress % is derived (saved/target), not stored.

**Endpoints** (auth-scoped, zod): `GET /api/goals`, `POST /api/goals` (name/emoji/target/theme), `PATCH /api/goals/[id]` (edit name/emoji/target, or contribute via `addAmount` $inc, or absolute `saved`), `DELETE /api/goals/[id]` (soft-delete isActive=false). Cross-user PATCH/DELETE → 404 (queries scoped by `{_id, userId}`).

**Themes + suggestions** live in `src/modules/goals/goalThemes.js` (shared by seed + frontend): `GOAL_THEMES` (5-color palette), `GOAL_SUGGESTIONS` (one-tap presets: emergency fund, vacation, bike, phone, car, home, wedding, education, laptop, festive), `GOAL_EMOJIS` (picker). Suggestions are frontend quick-add chips (not user data) and are filtered to hide already-added names.

**Frontend** `src/features/goals/`: `GoalsSection.jsx` (cards w/ progress + "Add money" + edit + remove, empty state, suggestion chips) rendered inside `Discover.jsx` (replaced the old static goals block); `GoalSheet.jsx` (create/edit, emoji picker, prefill from suggestion); `ContributeSheet.jsx` (add money, quick chips, live progress preview, "Goal reached" at 100%).

**Why/how to apply:** Discover's `discover.data.js` no longer carries `goals` (still serves mfPicks/cryptoWatch/fdRates as market research — those stay curated, they aren't personal data). Seed gives the demo user 3 real goals (New bike/Goa trip/Emergency fund); new users start empty → see the empty state + suggestions. Same pattern as [[profile-feature]]: per-user data, soft-delete, restart dev after model changes.
