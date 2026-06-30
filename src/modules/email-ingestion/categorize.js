/**
 * Merchant → category inference for transactions.
 *
 * Maps a parsed merchant / UPI-VPA / narration string to one of the project's
 * EXISTING category keys (see src/seed/seed.js → categories):
 *   food · shopping · bills · transport · entertainment · health · services ·
 *   income · other
 * We deliberately reuse this 9-key taxonomy rather than inventing a parallel
 * set, so the "Where it went" chart, the category picker, and breakdowns all
 * line up. Groceries → food, fuel → transport, education/investments/rent →
 * services, ATM/transfers/unknown → other.
 *
 * Returns { categoryKey, icon, iconBg, categorySource } where categorySource is
 *   'merchant-rule' → a keyword rule (or the credit→income rule) matched
 *   'default'       → nothing matched; fell back to 'other'
 * The AI ('ai') and 'manual' sources are set elsewhere (aiExtract / confirm-edit).
 */

const CATEGORY_STYLE = {
  food: { icon: '🍔', iconBg: '#FFEDE9' },
  shopping: { icon: '🛍️', iconBg: '#F4ECFF' },
  bills: { icon: '⚡', iconBg: '#FFF4DB' },
  transport: { icon: '🚕', iconBg: '#E6F8F5' },
  entertainment: { icon: '🎬', iconBg: '#FFE9F1' },
  health: { icon: '🩺', iconBg: '#EAFBF1' },
  services: { icon: '🧾', iconBg: '#EFEAFB' },
  income: { icon: '💰', iconBg: '#EAF7EF' },
  other: { icon: '💳', iconBg: '#F1EEF6' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_STYLE);

/**
 * Ordered rule table — FIRST match wins, so list more specific buckets before
 * broad ones (e.g. food/grocery before the generic shopping "store"/"retail").
 * Each entry is [categoryKey, regex] tested against the NORMALIZED merchant.
 */
const RULES = [
  // Food & Dining + Groceries
  ['food', /swiggy|zomato|eatfit|faasos|freshmenu|box8|dominos|domino|pizza|kfc|mcdonald|burger king|subway|starbucks|barista|cafe|coffee|chai point|restaurant|dhaba|biryani|haldiram|dunzo|bigbasket|big basket|blinkit|zepto|instamart|grofers|jiomart|jio mart|dmart|d mart|reliance fresh|reliance smart|more retail|spencer|grocery|kirana|licious|country delight|milk|dairy/],
  // Shopping / retail
  ['shopping', /amazon|flipkart|myntra|ajio|meesho|nykaa|tatacliq|tata cliq|snapdeal|croma|reliance digital|vijay sales|decathlon|ikea|lifestyle|pantaloons|westside|shoppers stop|lenskart|firstcry|boat|\bh m\b|zara|uniqlo|mall|store|retail|shopping|bazaar|fashion/],
  // Transport / Travel + Fuel
  ['transport', /uber|ola |\bola\b|rapido|namma yatri|blusmart|irctc|railway|makemytrip|make my trip|goibibo|yatra|cleartrip|easemytrip|redbus|abhibus|ixigo|indigo|spicejet|vistara|air india|akasa|flight|airlines|\bmetro\b|dmrc|bmrc|fastag|\btoll\b|parking|hpcl|iocl|indian oil|indianoil|bharat petroleum|bpcl|hindustan petroleum|nayara|\bshell\b|petrol|diesel|\bfuel\b|petro|\bhp\b/],
  // Bills & Utilities + Telecom + Recharge
  ['bills', /electricity|bescom|mseb|tneb|kseb|tata power|adani electricity|torrent power|\bbses\b|recharge|airtel|jio(?!cinema| cinema)|vodafone|\bvi\b|\bidea\b|bsnl|broadband|fibernet|act fibernet|hathway|\bgas\b|indane|bharat gas|water bill|\bdth\b|tata sky|dish tv|\bd2h\b|postpaid|prepaid|bill payment|\bbbps\b|utility/],
  // Entertainment / Subscriptions
  ['entertainment', /netflix|spotify|hotstar|disney|prime video|jiocinema|jio cinema|sony liv|sonyliv|zee5|\bvoot\b|gaana|\bwynk\b|youtube premium|bookmyshow|book my show|\bpvr\b|\binox\b|cinepolis|cinema|\bmovie|gaming|playstation|\bsteam\b|xbox/],
  // Health / Pharmacy
  ['health', /apollo|pharmeasy|pharm easy|\b1mg\b|tata 1mg|netmeds|medplus|med plus|wellness forever|hospital|clinic|nursing|diagnostic|pathology|\blab\b|practo|cultfit|cult fit|healthkart|pharmacy|medical|chemist|dental|\bdoctor\b/],
  // Services (misc) + Finance/Investments + Education + Rent/Housing + Insurance
  ['services', /urban company|urbanclap|housejoy|\bsalon\b|\bspa\b|barber|laundry|dryclean|courier|\bdtdc\b|bluedart|blue dart|delhivery|fedex|zerodha|groww|upstox|kuvera|paytm money|angel one|angelone|icici direct|hdfc securities|mutual fund|\bsip\b|\belss\b|\bnps\b|\blic\b|insurance|policybazaar|policy bazaar|\bpremium\b|byju|unacademy|udemy|coursera|vedantu|whitehat|toppr|simplilearn|skillshare|\brent\b|nobroker|no broker|housing|nestaway|maintenance|society/],
];

/** Normalize a merchant/VPA/narration for matching. */
export function normalizeMerchant(merchant) {
  return String(merchant || '')
    .toLowerCase()
    .replace(/\bvpa\b/g, ' ')           // drop the literal "VPA" token
    .replace(/@[a-z0-9.\-_]+/g, ' ')    // drop UPI handle suffix (@okhdfcbank, @ybl, @paytm)
    .replace(/[^a-z0-9 ]+/g, ' ')       // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Infer a category. Credits default to income (a deterministic rule).
 * @returns {{categoryKey:string, icon:string, iconBg:string, categorySource:string}}
 */
export function categorize(merchant, direction) {
  if (direction === 'credit') {
    return { categoryKey: 'income', ...CATEGORY_STYLE.income, categorySource: 'merchant-rule' };
  }
  const text = normalizeMerchant(merchant);
  if (text) {
    for (const [key, re] of RULES) {
      if (re.test(text)) return { categoryKey: key, ...CATEGORY_STYLE[key], categorySource: 'merchant-rule' };
    }
  }
  return { categoryKey: 'other', ...CATEGORY_STYLE.other, categorySource: 'default' };
}

/** Look up the icon/iconBg for a known category key (used when AI returns a key). */
export function styleForCategory(key) {
  return CATEGORY_STYLE[key] || CATEGORY_STYLE.other;
}
