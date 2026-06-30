'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import Sheet from '../../common/ui/Sheet.jsx';

/**
 * Pick/change a transaction's category. Used by both NEEDS REVIEW cards
 * (confirm + categorize) and normal rows (re-categorize).
 *
 * Props:
 *  - txn: the transaction being edited (for the header + current category)
 *  - confirmOnPick: when true, also flips needs_review → confirmed
 *  - onSaved(): refresh callback
 */
export default function CategoryPickerSheet({ open, onClose, txn, confirmOnPick = false, onSaved }) {
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.getCategories().then((r) => setCats(r.data || [])).catch(() => setCats([]));
  }, [open]);

  if (!txn) return null;

  async function pick(key) {
    if (busy) return;
    setBusy(true);
    try {
      if (confirmOnPick) {
        await api.confirmTransaction(txn._id, { categoryKey: key });
      } else {
        await api.updateTransaction(txn._id, { categoryKey: key });
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>
        {confirmOnPick ? 'Confirm & categorize' : 'Edit category'}
      </div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.muted, marginTop: 5 }}>
        {txn.merchant} · pick a category
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>
        {cats.map((c) => {
          const active = c.key === txn.categoryKey;
          return (
            <div
              key={c.key}
              onClick={() => pick(c.key)}
              style={{
                cursor: busy ? 'default' : 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12.5,
                padding: '10px 13px', borderRadius: 15,
                border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3',
                background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {c.emoji} {c.label}
            </div>
          );
        })}
      </div>
      <div onClick={onClose} style={{ marginTop: 18, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
