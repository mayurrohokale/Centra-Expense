'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import Sheet from '../../common/ui/Sheet.jsx';

const TYPES = [
  { key: 'mutual_fund', label: 'Mutual Fund', emoji: '📊', color: '#6C5CE7' },
  { key: 'crypto', label: 'Crypto', emoji: '🪙', color: '#F7931A' },
  { key: 'fd', label: 'Fixed Deposit', emoji: '🏦', color: '#0050A0' },
];

// Manually add a holding (the Invest "Add manually" flow) → POST /api/holdings.
export default function AddHoldingSheet({ open, onClose, onDone }) {
  const [type, setType] = useState('mutual_fund');
  const [name, setName] = useState('');
  const [invested, setInvested] = useState('');
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function reset() { setName(''); setInvested(''); setCurrent(''); setErr(''); setType('mutual_fund'); }
  function close() { reset(); onClose(); }

  async function submit() {
    if (busy) return;
    setErr('');
    const inv = parseFloat(invested);
    const cur = parseFloat(current);
    if (!name.trim()) { setErr('Enter a name.'); return; }
    if (Number.isNaN(inv) || inv < 0) { setErr('Enter the invested amount.'); return; }
    if (Number.isNaN(cur) || cur < 0) { setErr('Enter the current value.'); return; }
    const meta = TYPES.find((t) => t.key === type);
    setBusy(true);
    try {
      await api.createHolding({
        instrumentType: type,
        name: name.trim(),
        tag: name.trim().slice(0, 2).toUpperCase(),
        color: meta.color,
        subtitle: 'Added manually',
        investedValue: inv,
        currentValue: cur,
      });
      reset();
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const field = (label, value, setter, prefix) => (
    <>
      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '14px 2px 7px', letterSpacing: '.4px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>
        {prefix && <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 20, color: COLOR.ink }}>{prefix}</span>}
        <input value={value} onChange={(e) => setter(prefix ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)} inputMode={prefix ? 'decimal' : 'text'} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: prefix ? FONT.jakarta : FONT.inter, fontWeight: prefix ? 800 : 600, fontSize: prefix ? 20 : 14, color: COLOR.ink, minWidth: 0 }} />
      </div>
    </>
  );

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>Add holding manually</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.muted, marginTop: 5 }}>For assets we can't auto-fetch yet.</div>

      {err && <div style={{ marginTop: 12, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '16px 2px 8px', letterSpacing: '.4px' }}>TYPE</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {TYPES.map((t) => {
          const active = t.key === type;
          return (
            <div key={t.key} onClick={() => setType(t.key)} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '10px 6px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
              {t.emoji}<br />{t.label}
            </div>
          );
        })}
      </div>

      {field('NAME', name, setName)}
      {field('INVESTED', invested, setInvested, '₹')}
      {field('CURRENT VALUE', current, setCurrent, '₹')}

      <div onClick={busy ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Add holding'}</div>
      <div onClick={close} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
