/**
 * Merchant → category inference for transactions.
 *
 * Maps a parsed merchant / UPI-VPA / narration string to one of the project's
 * category keys (see src/modules/categories/defaultCategories.js):
 *   food · groceries · shopping · fashion · bills · electricity · recharge ·
 *   transport · fuel · entertainment · health · rent · emi · services ·
 *   income · other
 * We reuse this taxonomy rather than inventing a parallel set, so the
 * "Where it went" chart, the category picker, and breakdowns all line up.
 * Education/investments/insurance → services; ATM/transfers/unknown → other.
 *
 * Returns { categoryKey, icon, iconBg, categorySource } where categorySource is
 *   'merchant-rule' → a keyword rule (or the credit→income rule) matched
 *   'default'       → nothing matched; fell back to 'other'
 * The AI ('ai') and 'manual' sources are set elsewhere (aiExtract / confirm-edit).
 */

const CATEGORY_STYLE = {
  food: { icon: '🍔', iconBg: '#FFEDE9' },
  groceries: { icon: '🛒', iconBg: '#FFF1E0' },
  shopping: { icon: '🛍️', iconBg: '#F4ECFF' },
  fashion: { icon: '👗', iconBg: '#FCE7F3' },
  bills: { icon: '⚡', iconBg: '#FFF4DB' },
  electricity: { icon: '💡', iconBg: '#FEF9C3' },
  recharge: { icon: '📱', iconBg: '#E0F2FE' },
  transport: { icon: '🚕', iconBg: '#E6F8F5' },
  fuel: { icon: '⛽', iconBg: '#FFEDD5' },
  entertainment: { icon: '🎬', iconBg: '#FFE9F1' },
  health: { icon: '🩺', iconBg: '#EAFBF1' },
  rent: { icon: '🏠', iconBg: '#EDE9FE' },
  emi: { icon: '🏦', iconBg: '#E0F2FE' },
  insurance: { icon: '🛡️', iconBg: '#E0F2F1' },
  investment: { icon: '📈', iconBg: '#DCFCE7' },
  services: { icon: '🧾', iconBg: '#EFEAFB' },
  transfer: { icon: '🔁', iconBg: '#EEF1F5' },
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
  // Groceries — supermarkets / quick-commerce / kirana / dairy. Listed BEFORE
  // food so grocery merchants don't fall into the restaurant bucket.
  ['groceries', /bigbasket|big basket|blinkit|zepto|instamart|swiggy instamart|grofers|jiomart|jio mart|dmart|d mart|dmart ready|reliance fresh|reliance smart|more retail|\bmore supermarket\b|spencer|star bazaar|natures basket|country delight|licious|fresh to home|freshtohome|grocery|groceries|kirana|supermarket|\bmilk\b|dairy|vegetables|\bsabzi\b/],
  // Food & Dining — restaurants / food delivery / cafes.
  ['food', /swiggy|zomato|eatfit|faasos|freshmenu|box8|dominos|domino|pizza|kfc|mcdonald|burger king|subway|starbucks|barista|cafe|coffee|chai point|restaurant|dhaba|biryani|haldiram|dunzo|eatsure|behrouz|ovenstory|\bfood\b/],
  // Fashion / apparel / footwear / beauty. Listed BEFORE shopping (broad retail).
  ['fashion', /myntra|ajio|nykaa|tatacliq|tata cliq|\bzara\b|\bh m\b|\bhandm\b|uniqlo|pantaloons|westside|\blifestyle\b|max fashion|maxfashion|fabindia|biba|\bw for woman\b|allen solly|van heusen|louis philippe|peter england|jockey|bata|metro shoes|\bcrocs\b|nike|adidas|puma|\bsketchers\b|skechers|fashion|apparel|clothing|footwear|\bshoes\b|cosmetics|\bbeauty\b|\bsalon\b/],
  // Shopping / general retail / electronics / marketplaces.
  ['shopping', /amazon|flipkart|meesho|snapdeal|croma|reliance digital|vijay sales|decathlon|ikea|shoppers stop|lenskart|firstcry|\bboat\b|\bmall\b|\bstore\b|retail|shopping|bazaar|\bmart\b/],
  // Fuel — petrol pumps / OMCs. Listed BEFORE transport.
  ['fuel', /hpcl|iocl|indian oil|indianoil|bharat petroleum|bpcl|hindustan petroleum|\bhpcl\b|nayara|essar|\bshell\b|reliance petroleum|jio bp|jio-bp|petrol|diesel|\bfuel\b|petro|filling station|fuel station|petrol pump/],
  // Transport / Travel.
  ['transport', /uber|ola |\bola\b|rapido|namma yatri|blusmart|irctc|railway|makemytrip|make my trip|goibibo|yatra|cleartrip|easemytrip|redbus|abhibus|ixigo|indigo|spicejet|vistara|air india|akasa|flight|airlines|\bmetro\b|dmrc|bmrc|fastag|\btoll\b|parking|\bcab\b|\bauto\b/],
  // Electricity — power discoms. Listed BEFORE bills.
  ['electricity', /electricity|\bbescom\b|\bmseb\b|\btneb\b|\bkseb\b|tata power|adani electricity|torrent power|\bbses\b|cesc|\bmsedcl\b|\bpgvcl\b|\bdgvcl\b|power bill|\bdiscom\b|powergrid|electric bill/],
  // Recharge & DTH — mobile / broadband / DTH top-ups. Listed BEFORE bills.
  ['recharge', /recharge|\bairtel\b|jio(?!cinema| cinema)|vodafone|\bvi\b|\bidea\b|\bbsnl\b|broadband|fibernet|act fibernet|hathway|\bdth\b|tata sky|tatasky|dish tv|dishtv|\bd2h\b|postpaid|prepaid|\btopup\b|top up|mobile bill/],
  // Bills & Utilities (remaining: gas / water / generic bill payment).
  ['bills', /\bgas\b|indane|bharat gas|\bhp gas\b|water bill|\bbwssb\b|bill payment|\bbbps\b|utility|municipal|property tax/],
  // Entertainment / Subscriptions.
  ['entertainment', /netflix|spotify|hotstar|disney|prime video|jiocinema|jio cinema|sony liv|sonyliv|zee5|\bvoot\b|gaana|\bwynk\b|youtube premium|bookmyshow|book my show|\bpvr\b|\binox\b|cinepolis|cinema|\bmovie|gaming|playstation|\bsteam\b|xbox/],
  // Health / Pharmacy.
  ['health', /apollo|pharmeasy|pharm easy|\b1mg\b|tata 1mg|netmeds|medplus|med plus|wellness forever|hospital|clinic|nursing|diagnostic|pathology|\blab\b|practo|cultfit|cult fit|healthkart|pharmacy|medical|chemist|dental|\bdoctor\b/],
  // Rent & Housing. Listed BEFORE services.
  ['rent', /\brent\b|nobroker|no broker|nestaway|\bhousing\b|house rent|\bmaintenance\b|society maintenance|\bsociety\b|\blandlord\b|\bpg rent\b|\bflat\b/],
  // Loan / EMI. Listed BEFORE services.
  ['emi', /\bemi\b|loan emi|home loan|car loan|personal loan|bajaj finserv|bajaj finance|\bhdfc loan\b|loan repayment|loan payment|instalment|installment|\bcredit card payment\b|cc payment|\bnach\b|\becs\b/],
  // Insurance — life / health / term / general. Listed BEFORE services and
  // BEFORE investment (LIC can be both, but premium payments → insurance).
  ['insurance', /insurance|\blic\b|hdfc life|hdfc ergo|icici prudential|icici lombard|sbi life|max life|max bupa|bajaj allianz|tata aia|star health|niva bupa|care health|aditya birla health|kotak life|pnb metlife|policybazaar|policy bazaar|\bterm plan\b|term insurance|health insurance|life insurance|mediclaim|\bpremium\b|\bpolicy\b/],
  // Investment / SIP — broking + mutual-fund platforms + retirement. BEFORE services.
  ['investment', /zerodha|groww|upstox|kuvera|paytm money|angel one|angelone|icici direct|hdfc securities|kotak securities|\bcoin\b|indmoney|smallcase|\bsip\b|\bsystematic investment\b|mutual fund|\bmf\b|\belss\b|\bnps\b|\bppf\b|\bnav\b|invest|investment|sovereign gold bond|\bsgb\b/],
  // Services (misc) + Education.
  ['services', /urban company|urbanclap|housejoy|\bspa\b|barber|laundry|dryclean|courier|\bdtdc\b|bluedart|blue dart|delhivery|fedex|byju|unacademy|udemy|coursera|vedantu|whitehat|toppr|simplilearn|skillshare/],
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
