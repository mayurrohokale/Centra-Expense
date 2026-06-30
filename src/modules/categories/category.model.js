import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * categories — spend/income categories used for tagging and the
 * "Where it went" chart. Seeded with India-friendly defaults.
 */
const categorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true }, // stable id e.g. "food", "shopping"
    label: { type: String, required: true }, // "Food & Dining"
    emoji: { type: String, default: '🏷️' },
    color: { type: String, default: '#A78BFA' }, // gradient/solid for bars & icons
    kind: { type: String, enum: ['expense', 'income'], default: 'expense' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.index({ userId: 1, key: 1 }, { unique: true });

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
