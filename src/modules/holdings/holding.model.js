import mongoose from 'mongoose';

const { Schema } = mongoose;

// mutual_fund / crypto / fd are the auto-syncable types (AA / CAS / market data).
// stocks / gold / other are additionally available for MANUAL entries (assets we
// can't auto-fetch) so users can track their whole portfolio in one place.
export const INSTRUMENT_TYPES = ['mutual_fund', 'crypto', 'fd', 'stocks', 'gold', 'other'];

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

    // Currency the holding is tracked/priced in. Crypto is USD (global
    // convention); everything else is INR. Drives $ vs ₹ display + which live
    // price feed is used.
    currency: { type: String, enum: ['INR', 'USD'], default: 'INR' },

    // Manual CRYPTO specifics (live P/L from CoinGecko spot):
    //  coinId       = CoinGecko id (e.g. "bitcoin") for the price lookup
    //  quantity     = units held (also mirrored into `units`)
    //  buyPriceUsd  = cost per unit in USD at purchase
    //  purchaseDate = when bought
    // currentValue for crypto is recomputed live (quantity × spot USD) on read.
    coinId: { type: String, default: null },
    buyPriceUsd: { type: Number, default: null },
    purchaseDate: { type: Date, default: null },

    // FD specifics
    interestRate: { type: Number, default: null },
    maturityDate: { type: Date, default: null },
    // FD principal + lifecycle (manual FD with maturity auto-credit):
    //  principal       = amount deposited (₹)
    //  fdStartDate     = deposit date
    //  creditAccountId = bank account credited on maturity
    //  maturityValue   = projected value at maturity (quarterly compounding)
    //  maturedCredited = idempotency guard: true once the maturity credit posted
    principal: { type: Number, default: null },
    fdStartDate: { type: Date, default: null },
    creditAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    maturityValue: { type: Number, default: null },
    maturedCredited: { type: Boolean, default: false },

    source: { type: String, enum: ['aa_sync', 'cas_upload', 'manual'], default: 'aa_sync' },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

holdingSchema.index({ userId: 1, instrumentType: 1 });

export const Holding = mongoose.models.Holding || mongoose.model('Holding', holdingSchema);
