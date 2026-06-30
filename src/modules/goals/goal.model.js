import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * goals — user savings goals shown on the Discover/Research tab.
 *
 * Real, user-owned data (source of truth for the "Your goals" cards). `saved`
 * is the amount put aside so far; progress % is derived (saved / target). The
 * card styling (bg/border/accent) is stored so the UI renders a consistent,
 * colorful card without recomputing from a theme map.
 */
const goalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true }, // "Emergency fund"
    emoji: { type: String, default: '🎯' },

    target: { type: Number, required: true, min: 1 },
    saved: { type: Number, default: 0, min: 0 },

    // Card theme (chosen on create from a palette; persisted for stable styling).
    accent: { type: String, default: '#A78BFA' },
    bg: { type: String, default: 'linear-gradient(120deg,#F4ECFF,#E9DBFF)' },
    border: { type: String, default: '#ddc9fb' },

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

goalSchema.index({ userId: 1, isActive: 1 });

export const Goal = mongoose.models.Goal || mongoose.model('Goal', goalSchema);
