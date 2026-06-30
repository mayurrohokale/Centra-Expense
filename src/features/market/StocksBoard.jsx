'use client';
import { useEffect, useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { usePoll } from '../../common/hooks/usePoll.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { fmtPrice, fmtPct } from '../../common/lib/format.js';
import LiveBadge from './LiveBadge.jsx';

// Small colored pill for a search result's instrument type.
const TYPE_PILL = {
  crypto: { bg: '#F4ECFF', fg: '#8b5cf6', label: 'Crypto' },
  equity: { bg: '#E7F3FF', fg: '#2B7FE0', label: 'Stock' },
  etf: { bg: '#EAF7EF', fg: '#1FAE63', label: 'ETF' },
};

function StockRow({ s, onClick }) {
  const up = (s.changePct ?? 0) >= 0;
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1.5px solid #f6f2fa', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: s.color || '#6C5CE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 11, color: '#fff' }}>{s.tag || (s.symbol || '').slice(0, 4)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{s.symbol}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 15, color: COLOR.ink, letterSpacing: '-.3px' }}>{fmtPrice(s.price, s.currency)}</div>
        <div style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: up ? '#16a34a' : '#FF6B5E' }}>{up ? '▲' : '▼'} {fmtPct(s.changePct)}</div>
      </div>
    </div>
  );
}

export default function StocksBoard({ onOpen }) {
  const stocks = useApi(api.getStocks, []);
  // Refresh quotes every 120s while visible; server caches 120s → low upstream load.
  usePoll(stocks.refetch, 120000);

  const { indian = [], global = [], privateGiants = [] } = stocks.data || {};

  // Search
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.searchStocks(term);
        if (active) setResults(res.data || []);
      } catch { if (active) setResults([]); }
      finally { if (active) setSearching(false); }
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  // Open the chart detail page for a symbol (and clear the search). `type` (from
  // a search result) lets crypto route to the CoinGecko chart.
  const open = (sym, name, type) => { setResults([]); setQ(''); onOpen?.(sym, name, type); };

  const card = { borderRadius: 24, background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6', overflow: 'hidden' };

  return (
    <>
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '26px 4px 13px' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, letterSpacing: '-.2px' }}>📈 Stocks & crypto</div>
        <LiveBadge />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 15px', borderRadius: 18, background: '#fff', border: '1.5px solid #f1ecf6', boxShadow: '0 8px 18px rgba(90,70,130,.05)' }}>
        <span style={{ fontSize: 15 }}>🔍</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search crypto or stocks — BTC, Apple, Tata…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT.inter, fontWeight: 600, fontSize: 13, color: COLOR.ink }} />
      </div>

      {(results.length > 0 || searching) && (
        <div style={{ ...card, marginTop: 10 }}>
          {searching && results.length === 0 && <div style={{ padding: '13px 16px', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft }}>Searching…</div>}
          {results.map((r) => {
            const pill = TYPE_PILL[r.type] || TYPE_PILL.equity;
            return (
              <div key={r.symbol} onClick={() => open(r.symbol, r.name, r.type)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderBottom: '1.5px solid #f6f2fa', cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: COLOR.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    <span style={{ flexShrink: 0, fontFamily: FONT.inter, fontWeight: 800, fontSize: 9.5, letterSpacing: '.3px', padding: '2px 7px', borderRadius: 10, background: pill.bg, color: pill.fg }}>{pill.label}</span>
                  </div>
                  <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11, color: COLOR.mutedSoft }}>{r.symbol}{r.exchange ? ` · ${r.exchange}` : ''}</div>
                </div>
                <span style={{ flexShrink: 0, fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13, color: COLOR.purple }}>View ›</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Popular Indian */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11.5, color: COLOR.mutedSoft, letterSpacing: '.5px', margin: '18px 4px 10px' }}>POPULAR · INDIA 🇮🇳</div>
      <div style={card}>
        {indian.length ? indian.map((s) => <StockRow key={s.symbol} s={s} onClick={() => open(s.symbol, s.name)} />) : (
          <div style={{ padding: '14px 16px', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft }}>{stocks.loading ? 'Loading live quotes…' : 'Quotes unavailable right now.'}</div>
        )}
      </div>

      {/* Global giants */}
      <div style={{ fontFamily: FONT.inter, fontWeight: 800, fontSize: 11.5, color: COLOR.mutedSoft, letterSpacing: '.5px', margin: '20px 4px 10px' }}>GLOBAL GIANTS 🌎</div>
      <div style={card}>
        {global.length ? global.map((s) => <StockRow key={s.symbol} s={s} onClick={() => open(s.symbol, s.name)} />) : (
          <div style={{ padding: '14px 16px', fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft }}>{stocks.loading ? 'Loading live quotes…' : 'Quotes unavailable right now.'}</div>
        )}
      </div>

      {/* (Removed the "not publicly traded" private-giants note per product decision.) */}
    </>
  );
}
