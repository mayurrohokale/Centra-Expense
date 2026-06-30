import mongoose from 'mongoose';

const { Schema } = mongoose;

export const INSTRUMENT_TYPES = ['mutual_fund', 'crypto', 'fd'];

/**
 * holdings — investment positions surfaced on the Invest tab.
 * Tracks invested value vs current value so P&L / XIRR can be derived.
 */
const holdingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', index: true },

    instrumentType: { type: String, enum: INSTRUMENT_TYPES, required: true, index: true },
    name: { type: String, required: true, trim: true }, // "Parag Parikh Flexi Cap"
    tag: { type: String, default: '' }, // short badge e.g. "PP", "BTC"
    color: { type: String, default: '#6C5CE7' },
    subtitle: { type: String, default: '' }, // "SIP ₹8,000/mo", "0.034 BTC", "Matures Mar 2027"

    investedValue: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, required: true, min: 0 },

    units: { type: Number, default: null }, // MF units / crypto qty
    // MFAPI scheme code for mutual funds → enables live NAV lookups
    schemeCode: { type: String, default: null },
    // FD specifics
    interestRate: { type: Number, default: null },
    maturityDate: { type: Date, default: null },

    source: { type: String, enum: ['aa_sync', 'cas_upload', 'manual'], default: 'aa_sync' },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

holdingSchema.index({ userId: 1, instrumentType: 1 });

export const Holding = mongoose.models.Holding || mongoose.model('Holding', holdingSchema);
