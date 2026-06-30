'use client';
import { useState } from 'react';
import { api } from '../../common/lib/api.js';
import { useApi } from '../../common/hooks/useApi.js';
import { FONT, COLOR } from '../../common/theme/tokens.js';
import { ErrorState } from '../../common/ui/States.jsx';
import { DiscoverSkeleton } from '../../common/ui/Skeleton.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import GoalsSection from '../goals/GoalsSection.jsx';
import LiveCrypto from '../market/LiveCrypto.jsx';
import StocksBoard from '../market/StocksBoard.jsx';
import TrendingFunds from '../market/TrendingFunds.jsx';
import InstrumentDetail from '../market/InstrumentDetail.jsx';
import CryptoDetail from '../market/CryptoDetail.jsx';
import FundDetail from '../market/FundDetail.jsx';

// A Yahoo-style crypto symbol looks like "BTC-USD"; search results also pass a
// type hint. Either signal routes the instrument to the CoinGecko crypto chart.
const isCryptoInstrument = (symbol, type) =>
  type === 'crypto' || (typeof symbol === 'string' && /-USD$/i.test(symbol));

export default function Discover() {
  const { logout } = useAuth();
  // Selected instrument (stock/crypto) → renders the chart detail page in place.
  const [detail, setDetail] = useState(null); // { symbol, name, crypto } | null
  const openInstrument = (symbol, name, type) =>
    setDetail({ symbol, name, crypto: isCryptoInstrument(symbol, type) });
  // Selected trending mutual fund → renders the fund detail (chart + SIP calc).
  const [fund, setFund] = useState(null); // { schemeCode, name } | null
  const openFund = (schemeCode, name) => setFund({ schemeCode, name });

  // Curated FD rates still come from the discover endpoint (no public FD API);
  // crypto/stocks/funds are now live from public APIs in their own components.
  const { data, loading, error, refetch } = useApi(api.getDiscover, []);

  if (fund) {
    return <FundDetail schemeCode={fund.schemeCode} name={fund.name} onBack={() => setFund(null)} />;
  }

  if (detail) {
    return detail.crypto
      ? <CryptoDetail id={detail.symbol} name={detail.name} onBack={() => setDetail(null)} />
      : <InstrumentDetail symbol={detail.symbol} name={detail.name} onBack={() => setDetail(null)} />;
  }

  if (loading) return <DiscoverSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { fdRates = [] } = data || {};

  return (
    <div style={{ padding: '8px 18px 24px' }}>
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 25, color: COLOR.ink, margin: '6px 4px 18px', letterSpacing: '-.6px' }}>Discover 🔍</div>

      {/* goals — real, user-owned (CRUD + quick-add suggestions) */}
      <GoalsSection />

      {/* live crypto (CoinGecko) */}
      <LiveCrypto onOpen={openInstrument} />

      {/* live stocks: Indian + global giants + search (Yahoo Finance) */}
      <StocksBoard onOpen={openInstrument} />

      {/* trending mutual funds with live returns (MFAPI) → tap for detail */}
      <TrendingFunds onOpen={openFund} />

      {/* FD rates — curated research (no public FD API) */}
      <div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 17, color: COLOR.ink, margin: '26px 4px 13px', letterSpacing: '-.2px' }}>🏦 Best FD rates</div>
      <div style={{ borderRadius: 24, background: '#fff', boxShadow: '0 10px 22px rgba(90,70,130,.07)', border: '1.5px solid #f1ecf6', overflow: 'hidden' }}>
        {fdRates.map((fd) => (
          <div key={fd.bank} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 17px', borderBottom: '1.5px solid #f6f2fa' }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: fd.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 13, color: '#fff' }}>{fd.tag}</div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{fd.bank}</div><div style={{ fontFamily: FONT.inter, fontWeight: 600, fontSize: 11.5, color: COLOR.mutedSoft }}>{fd.tenure}</div></div>
            <div style={{ fontFamily: FONT.jakarta, fontWeight: 800, fontSize: 17, color: '#16a34a', letterSpacing: '-.3px' }}>{fd.rate}</div>
          </div>
        ))}
      </div>

      <div onClick={logout} style={{ marginTop: 22, textAlign: 'center', padding: 14, borderRadius: 16, background: '#fff', border: '1.5px solid #f1ecf6', fontFamily: FONT.jakarta, fontWeight: 700, fontSize: 13.5, color: '#FF6B5E', cursor: 'pointer' }}>🚪 Log out</div>
    </div>
  );
}
