'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { fmtPrice } from '../../common/lib/format.js';
import Sheet from '../../common/ui/Sheet.jsx';

// Manual-investment types. mutual_fund/crypto/fd overlap with auto-sync types;
// stocks/gold/other are manual-only assets we can't auto-fetch.
const TYPES = [
  { key: 'mutual_fund', label: 'Mutual Fund', emoji: '📊', color: '#6C5CE7' },
  { key: 'stocks', label: 'Stocks', emoji: '📈', color: '#2B7FE0' },
  { key: 'crypto', label: 'Crypto', emoji: '🪙', color: '#F7931A' },
  { key: 'gold', label: 'Gold', emoji: '🥇', color: '#D4A017' },
  { key: 'fd', label: 'Fixed Deposit', emoji: '🏦', color: '#0050A0' },
  { key: 'other', label: 'Other', emoji: '💼', color: '#64748B' },
];

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoOf(dateStr) { return new Date(dateStr + 'T08:00:00').toISOString(); }

/**
 * Add / edit a MANUAL holding. Generic types (MF/stocks/gold/other) collect a
 * simple invested + optional current value. CRYPTO collects coin + quantity +
 * buy price (USD) + purchase date → live USD P/L. FD collects principal + rate +
 * start + maturity (or tenure) + account to credit on maturity.
 */
export default function AddHoldingSheet({ open, onClose, onDone, holding }) {
  const editing = !!holding;
  const [type, setType] = useState('mutual_fund');
  const [name, setName] = useState('');
  const [invested, setInvested] = useState('');
  const [current, setCurrent] = useState('');
  // crypto
  const [coins, setCoins] = useState([]);
  const [coinId, setCoinId] = useState('');
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayInput());
  // fd
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [fdStart, setFdStart] = useState(todayInput());
  const [tenureMonths, setTenureMonths] = useState('12');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    if (holding) {
      setType(holding.instrumentType || 'mutual_fund');
      setName(holding.name || '');
      setInvested(holding.investedValue != null ? String(holding.investedValue) : '');
      setCurrent(holding.currentValue != null ? String(holding.currentValue) : '');
      setCoinId(holding.coinId || '');
      setQty(holding.units != null ? String(holding.units) : '');
      setBuyPrice(holding.buyPriceUsd != null ? String(holding.buyPriceUsd) : '');
      setPurchaseDate(holding.purchaseDate ? String(holding.purchaseDate).slice(0, 10) : todayInput());
      setPrincipal(holding.principal != null ? String(holding.principal) : '');
      setRate(holding.interestRate != null ? String(holding.interestRate) : '');
      setFdStart(holding.fdStartDate ? String(holding.fdStartDate).slice(0, 10) : todayInput());
      setCreditAccountId(holding.creditAccountId ? String(holding.creditAccountId) : '');
    } else {
      setType('mutual_fund'); setName(''); setInvested(''); setCurrent('');
      setCoinId(''); setQty(''); setBuyPrice(''); setPurchaseDate(todayInput());
      setPrincipal(''); setRate(''); setFdStart(todayInput()); setTenureMonths('12'); setCreditAccountId('');
    }
    // Load live coins (for the crypto picker) + bank accounts (FD credit target).
    api.getCrypto().then((r) => setCoins(r.data || [])).catch(() => setCoins([]));
    api.getAccounts().then((r) => {
      const banks = (r.data || []).filter((a) => a.type === 'bank');
      setAccounts(banks);
      setCreditAccountId((cur) => cur || banks[0]?._id || '');
    }).catch(() => setAccounts([]));
  }, [open, holding]);

  function close() { onClose(); }

  const selectedCoin = coins.find((c) => c.id === coinId);
  const qtyNum = parseFloat(qty) || 0;
  const buyNum = parseFloat(buyPrice) || 0;
  // Maturity date from start + tenure (months).
  function maturityFromTenure() {
    const d = new Date(fdStart + 'T08:00:00');
    d.setMonth(d.getMonth() + (parseInt(tenureMonths, 10) || 0));
    return d;
  }
  // Quarterly-compounding maturity preview (matches server formula).
  function fdPreview() {
    const p = parseFloat(principal) || 0;
    const r = parseFloat(rate) || 0;
    const mat = maturityFromTenure();
    const years = (mat.getTime() - new Date(fdStart + 'T08:00:00').getTime()) / (365.25 * 86400000);
    if (p <= 0 || r <= 0 || years <= 0) return { value: p, mat };
    return { value: Math.round(p * Math.pow(1 + r / 400, 4 * years)), mat };
  }

  async function submit() {
    if (busy) return;
    setErr('');
    try {
      let body;
      if (type === 'crypto') {
        if (!coinId) { setErr('Pick a coin.'); return; }
        if (qtyNum <= 0) { setErr('Enter the quantity held.'); return; }
        if (buyNum <= 0) { setErr('Enter your buy price (USD per unit).'); return; }
        body = {
          instrumentType: 'crypto',
          name: selectedCoin ? `${selectedCoin.name}` : (name.trim() || coinId),
          tag: selectedCoin?.tag || coinId.slice(0, 3).toUpperCase(),
          color: '#F7931A',
          subtitle: `${qtyNum} ${selectedCoin?.tag || ''} · bought @ $${buyNum}`,
          coinId,
          units: qtyNum,
          buyPriceUsd: buyNum,
          investedValue: Number((qtyNum * buyNum).toFixed(2)),
          purchaseDate: isoOf(purchaseDate),
        };
      } else if (type === 'fd') {
        const p = parseFloat(principal);
        const r = parseFloat(rate);
        if (!name.trim()) { setErr('Name your FD (e.g. HDFC FD).'); return; }
        if (!p || p <= 0) { setErr('Enter the principal amount.'); return; }
        if (!r || r <= 0) { setErr('Enter the annual interest rate %.'); return; }
        if (!creditAccountId) { setErr('Pick the account to credit on maturity.'); return; }
        const mat = maturityFromTenure();
        body = {
          instrumentType: 'fd',
          name: name.trim(),
          tag: name.trim().slice(0, 2).toUpperCase(),
          color: '#0050A0',
          subtitle: `${r}% p.a. · matures ${mat.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
          principal: p,
          investedValue: p,
          interestRate: r,
          fdStartDate: isoOf(fdStart),
          maturityDate: mat.toISOString(),
          creditAccountId,
        };
      } else {
        const inv = parseFloat(invested);
        if (!name.trim()) { setErr('Enter a name.'); return; }
        if (Number.isNaN(inv) || inv < 0) { setErr('Enter the invested amount.'); return; }
        const cur = current.trim() === '' ? undefined : parseFloat(current);
        if (cur !== undefined && (Number.isNaN(cur) || cur < 0)) { setErr('Current value looks invalid.'); return; }
        const meta = TYPES.find((t) => t.key === type);
        body = {
          instrumentType: type,
          name: name.trim(),
          tag: name.trim().slice(0, 2).toUpperCase(),
          color: meta.color,
          subtitle: 'Added manually',
          investedValue: inv,
          ...(cur !== undefined ? { currentValue: cur } : {}),
        };
      }

      setBusy(true);
      if (editing) await api.updateHolding(holding._id, body);
      else await api.createHolding(body);
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const label = (t) => <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: COLOR.mutedSoft, margin: '14px 2px 7px', letterSpacing: '.4px' }}>{t}</div>;
  const box = (children) => <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 16, background: '#FBF8F4', border: '1.5px solid #f1ecf6' }}>{children}</div>;
  const textInput = (value, setter, placeholder, prefix, numeric) => box(
    <>
      {prefix && <span style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 20, color: COLOR.ink }}>{prefix}</span>}
      <input value={value} onChange={(e) => setter(numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)} inputMode={numeric ? 'decimal' : 'text'} placeholder={placeholder || ''} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: numeric ? FONT.jakarta : FONT.inter, fontWeight: numeric ? 800 : 600, fontSize: numeric ? 20 : 14, color: COLOR.ink, minWidth: 0 }} />
    </>
  );
  const dateInput = (value, setter) => box(
    <input type="date" value={value} max={type === 'fd' ? undefined : todayInput()} onChange={(e) => setter(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.inter, fontWeight: 600, fontSize: 14, color: COLOR.ink, minWidth: 0 }} />
  );

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, color: COLOR.ink, letterSpacing: '-.3px' }}>{editing ? 'Edit investment' : 'Add investment manually'}</div>
      <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.muted, marginTop: 5 }}>Track assets you enter yourself.</div>

      {err && <div style={{ marginTop: 12, fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#d6483b' }}>⚠️ {err}</div>}

      {label('TYPE')}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TYPES.map((t) => {
          const active = t.key === type;
          return (
            <div key={t.key} onClick={() => setType(t.key)} style={{ flex: '1 0 28%', textAlign: 'center', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '10px 6px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
              {t.emoji}<br />{t.label}
            </div>
          );
        })}
      </div>

      {type === 'crypto' ? (
        <>
          {label('COIN')}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {coins.map((c) => {
              const active = c.id === coinId;
              return (
                <div key={c.id} onClick={() => setCoinId(c.id)} style={{ flex: '0 0 auto', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
                  {c.tag} {c.priceUsd != null ? `· ${fmtPrice(c.priceUsd, 'USD')}` : ''}
                </div>
              );
            })}
            {coins.length === 0 && <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft }}>Live coins unavailable — try again.</span>}
          </div>
          {label('QUANTITY')}
          {textInput(qty, setQty, '0.05', null, true)}
          {label('BUY PRICE (USD PER UNIT)')}
          {textInput(buyPrice, setBuyPrice, '30000', '$', true)}
          {label('PURCHASE DATE')}
          {dateInput(purchaseDate, setPurchaseDate)}
          {qtyNum > 0 && buyNum > 0 && (
            <div style={{ marginTop: 12, borderRadius: 14, padding: '11px 14px', background: '#FFF7ED', border: '1.5px solid #fde7c8', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, color: '#9a6a16' }}>
              Cost basis ${(qtyNum * buyNum).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              {selectedCoin?.priceUsd != null && (
                <span> · now ${(qtyNum * selectedCoin.priceUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })} (live)</span>
              )}
            </div>
          )}
        </>
      ) : type === 'fd' ? (
        <>
          {label('FD NAME')}
          {textInput(name, setName, 'e.g. HDFC Fixed Deposit')}
          {label('PRINCIPAL')}
          {textInput(principal, setPrincipal, '100000', '₹', true)}
          {label('ANNUAL INTEREST RATE (%)')}
          {textInput(rate, setRate, '7.1', null, true)}
          {label('START DATE')}
          {dateInput(fdStart, setFdStart)}
          {label('TENURE (MONTHS)')}
          {textInput(tenureMonths, setTenureMonths, '12', null, true)}
          {label('CREDIT TO ACCOUNT ON MATURITY')}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {accounts.map((a) => {
              const active = a._id === creditAccountId;
              return (
                <div key={a._id} onClick={() => setCreditAccountId(a._id)} style={{ flex: '0 0 auto', cursor: 'pointer', fontFamily: FONT.inter, fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 14, border: active ? '1.5px solid #2a2733' : '1.5px solid #eee6f3', background: active ? '#2a2733' : '#fff', color: active ? '#fff' : '#5a5366' }}>
                  {a.logo} {a.name}
                </div>
              );
            })}
            {accounts.length === 0 && <span style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12, color: COLOR.mutedSoft }}>Add a bank account first.</span>}
          </div>
          {(() => {
            const p = fdPreview();
            if (!(parseFloat(principal) > 0 && parseFloat(rate) > 0)) return null;
            return (
              <div style={{ marginTop: 12, borderRadius: 14, padding: '11px 14px', background: 'linear-gradient(120deg,#E9FBF3,#D6F5E8)', border: '1.5px solid #c5efdc' }}>
                <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5, color: '#13795f' }}>Matures {p.mat.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (quarterly compounding)</div>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 16, color: '#13795f', marginTop: 3 }}>≈ ₹{p.value.toLocaleString('en-IN')} on maturity</div>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {label('NAME')}
          {textInput(name, setName, 'e.g. Parag Parikh Flexi Cap, Sovereign Gold Bond')}
          {label('INVESTED')}
          {textInput(invested, setInvested, '', '₹', true)}
          {label('CURRENT VALUE (OPTIONAL)')}
          {textInput(current, setCurrent, 'leave blank if unknown', '₹', true)}
        </>
      )}

      <div onClick={busy ? undefined : submit} style={{ marginTop: 18, padding: 15, borderRadius: 18, background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)', textAlign: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add investment'}</div>
      <div onClick={close} style={{ marginTop: 9, textAlign: 'center', fontFamily: FONT.inter, fontWeight: 700, fontSize: 13, color: COLOR.mutedSoft, padding: 6, cursor: 'pointer' }}>Cancel</div>
    </Sheet>
  );
}
