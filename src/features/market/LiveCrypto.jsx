'use client';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { usePoll } from '../../common/hooks/usePoll.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { fmtPrice, fmtPct } from '../../common/lib/format.js';
import LiveBadge from './LiveBadge.jsx';

// Realtime crypto prices (CoinGecko), refreshed every 60s while the tab is
// visible. Server caches 60s, so polling never hammers the upstream API.
export default function LiveCrypto({ onOpen }) {
  const { data, loading, refetch } = useApi(api.getCrypto, []);
  usePoll(refetch, 60000);

  const coins = data || [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '26px 4px 13px' }}>
        <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, letterSpacing: '-.2px' }}>🪙 Crypto watch</div>
        <LiveBadge />
      </div>

      {coins.length === 0 ? (
        <div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 12.5, color: COLOR.mutedSoft, padding: '4px 4px 0' }}>
          {loading ? 'Loading live prices…' : 'Live prices unavailable right now.'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', margin: '0 -18px', padding: '2px 18px 6px' }}>
          {coins.map((c) => {
            const up = (c.change24h ?? 0) >= 0;
            return (
              <div key={c.tag} onClick={() => onOpen?.(c.symbol, c.name)} style={{ flex: '0 0 auto', width: 152, borderRadius: 22, padding: 16, background: c.bg, color: '#fff', cursor: onOpen ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 12 }}>{c.tag}</div>
                  <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                </div>
                <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 18, marginTop: 13, letterSpacing: '-.3px' }}>{fmtPrice(c.priceUsd, 'USD')}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.22)', borderRadius: 12, padding: '3px 9px', fontFamily: FONT.inter, fontWeight: 700, fontSize: 11.5 }}>
                    <span>{up ? '▲' : '▼'}</span> {fmtPct(c.change24h)}
                  </div>
                  {onOpen && <span style={{ fontFamily: FONT.inter, fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.9)' }}>📈</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
