/**
 * Curated Discover/Research content (market research, not personal data):
 * MF picks / crypto watch / FD rates are suggestions, not user holdings.
 *
 * NOTE: Goals are now REAL user-owned data in the `goals` collection
 * (see src/modules/goals/*) and are no longer served from here.
 */
export const discoverContent = {
  mfPicks: [
    { name: 'Quant Small Cap Fund', rating: '★★★★★ · CRISIL', returns: '28.4%', risk: 'High risk', riskBg: '#FFE9E5', riskFg: '#FF6B5E', category: 'Small Cap', schemeCode: '120828' },
    { name: 'Mirae Asset Large Cap', rating: '★★★★☆ · Value Research', returns: '15.2%', risk: 'Moderate', riskBg: '#FFF4DB', riskFg: '#D99100', category: 'Large Cap', schemeCode: '118825' },
    { name: 'ICICI Balanced Advantage', rating: '★★★★☆ · CRISIL', returns: '11.6%', risk: 'Low risk', riskBg: '#E6F8F1', riskFg: '#1FAE63', category: 'Hybrid', schemeCode: '120251' },
  ],
  cryptoWatch: [
    { tag: 'BTC', name: 'Bitcoin', price: '₹58.2L', change: '+6.2%', sentiment: 'Bullish', bg: 'linear-gradient(140deg,#F7931A,#FFB347)' },
    { tag: 'ETH', name: 'Ethereum', price: '₹2.9L', change: '+3.8%', sentiment: 'Bullish', bg: 'linear-gradient(140deg,#627EEA,#8FA2F5)' },
    { tag: 'SOL', name: 'Solana', price: '₹14.8k', change: '-2.1%', sentiment: 'Neutral', bg: 'linear-gradient(140deg,#9945FF,#14F195)' },
  ],
  fdRates: [
    { tag: 'UB', bank: 'Unity Small Finance', tenure: '1–2 yr tenure', rate: '9.0%', color: '#FF6FA5' },
    { tag: 'JN', bank: 'Jana Small Finance', tenure: '2–3 yr tenure', rate: '8.5%', color: '#A78BFA' },
    { tag: 'HD', bank: 'HDFC Bank', tenure: '1–2 yr tenure', rate: '7.1%', color: '#0050A0' },
    { tag: 'SB', bank: 'SBI', tenure: '1–2 yr tenure', rate: '6.8%', color: '#22409A' },
  ],
};
