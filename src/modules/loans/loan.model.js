import mongoose from 'mongoose';

const { Schema } = mongoose;

// 'borrowed' = the user GOT money from someone → the user OWES them.
// 'lent'     = the user GAVE money to someone → that person OWES the user.
export const LOAN_DIRECTIONS = ['borrowed', 'lent'];
export const LOAN_STATUSES = ['open', 'settled'];

/**
 * loans — money borrowed from / lent to other PEOPLE (not the user's own
 * accounts; transfers cover that). Each loan tracks the counterparty and the
 * outstanding amount still to settle.
 *
 * Balance wiring: every loan EVENT (creation + each repayment) creates a linked
 * CONFIRMED transaction (categoryKey 'loan', loanId set) that moves the real
 * bank/cash balance through the existing balance system. Repayments are NOT
 * stored on the loan — they are queried from transactions by `loanId` (one
 * source of truth, so balance reversal on delete stays consistent). The loan's
 * `outstanding` is the running remaining-to-settle figure, maintained as events
 * apply/reverse.
 */
const loanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    direction: { type: String, enum: LOAN_DIRECTIONS, required: true },
    counterpartyName: { type: String, required: true, trim: true }, // the other person

    principal: { type: Number, required: true, min: 1 }, // original amount
    outstanding: { type: Number, required: true, min: 0 }, // remaining to settle

    // Account the money was received into (borrowed) / paid from (lent) AT
    // CREATION. Repayments may use a different account (captured on their txn).
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    accountName: { type: String, default: '' },

    // The transaction created for the loan PRINCIPAL movement (credit for
    // borrowed, debit for lent). Deleting the loan reverses this txn too.
    principalTxnId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },

    note: { type: String, default: '' },
    status: { type: String, enum: LOAN_STATUSES, default: 'open', index: true },

    startDate: { type: Date, default: Date.now },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

loanSchema.index({ userId: 1, status: 1, direction: 1 });

export const Loan = mongoose.models.Loan || mongoose.model('Loan', loanSchema);
