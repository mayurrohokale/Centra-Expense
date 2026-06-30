---
name: profile-feature
description: Profile feature (view/edit profile, salary setup, account CRUD) — User schema additions and how salary feeds the Transactions card
metadata:
  type: project
---

Profile feature built & verified (single Next.js app). Reached via Header dropdown "View profile" item (above Log out); renders in place of the tabs via a `view` state in `app/page.jsx`, with a back arrow; BottomNav hidden in profile view.

**User schema additions** (`src/modules/users/user.model.js`): `phone` (String), `avatarColor` (String), `salary` { `amount` (Number, default 0), `payDay` (Number 1–31, default null) }. `currency` already existed. `toSafeUser`/toJSON still strip passwordHash.

**Endpoints**: `PATCH /api/auth/me` (name/phone/currency/email/salary; email uniqueness-guarded; never touches passwordHash) and `POST /api/auth/change-password` (verifies current via bcrypt). Account CRUD: `POST /api/accounts` (bank|cash; one cash wallet enforced — 409 on a 2nd), `PATCH /api/accounts/[id]` (now also institution/last4), `DELETE /api/accounts/[id]` (soft-delete isActive=false; cash wallet protected). Account model gained `institution` + `currency` fields.

**Why salary lives on User, not a Transaction:** the Transactions "upcoming-salary" card reads the live shell user (`useAuth().user.salary`) and computes the next pay date from `payDay` via `nextPayDate()` in `format.js`; empty state deep-links to profile via `openProfile()`. AuthContext extended with `openProfile/closeProfile/refreshUser` so edits update Header/greeting without reload.

**How to apply:** Seed sets demo user salary `{85000, payDay:1}` + phone. The running Mongoose model is process-cached — restart `npm run dev` after any schema change or new fields silently strip on writes.

**First-run onboarding wizard** (added later): User schema gained `onboarding { completed:false, skipped:false }`. Only genuinely-new signups carry `completed===false` → `app/page.jsx` renders `src/features/onboarding/OnboardingWizard.jsx` (welcome → add account → salary → done, with Skip; reuses Profile's AccountFormSheet + SalarySheet). Legacy/demo users have NO onboarding field (lean read → undefined), so `needsOnboarding = onboarding?.completed === false && !skipped` is false for them — deliberate, per user ("for genuinely new users"). `POST /api/auth/onboarding {action:complete|skip}` flips it; seed marks demo `completed:true`. Dashboard zero-state cleanup: illustrative `8.2%/12.4%`/trend stats hidden when `bankTotal===0`/`netWorth===0`; invested card hidden until holdings exist; "Add your first account" hero CTA + a "finish setup" banner when `onboarding.skipped`.
