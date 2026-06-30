'use client';
/**
 * Skeleton loaders — shimmer placeholders shown while async data loads, sized
 * to roughly match the real content so there's no layout shift on swap.
 *
 * Base: <Skeleton w h r /> renders one shimmer block (the `.skeleton` class +
 * its keyframe live in app/globals.css). Presets compose it into the common
 * shapes (text line, number, chip, circle, card, list row). Per-screen
 * skeletons at the bottom mirror each screen's layout.
 */

const CARD = { background: '#fff', borderRadius: 24, border: '1.5px solid #f1ecf6', boxShadow: '0 10px 22px rgba(90,70,130,.06)' };

export function Skeleton({ w = '100%', h = 14, r = 12, style = {} }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export const SkeletonText = ({ w = '100%', h = 12 }) => <Skeleton w={w} h={h} r={7} />;
export const SkeletonNumber = ({ w = 120, h = 26 }) => <Skeleton w={w} h={h} r={8} />;
export const SkeletonChip = ({ w = 78, h = 32 }) => <Skeleton w={w} h={h} r={16} />;
export const SkeletonCircle = ({ d = 42 }) => <Skeleton w={d} h={d} r={d / 2} />;

/** A generic card-with-icon row (used for transactions, holdings, etc.). */
export function SkeletonRow() {
  return (
    <div style={{ ...CARD, borderRadius: 22, padding: '15px 17px', display: 'flex', alignItems: 'center', gap: 13 }}>
      <Skeleton w={42} h={42} r={14} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonText w="55%" h={13} />
        <SkeletonText w="35%" h={10} />
      </div>
      <SkeletonNumber w={64} h={16} />
    </div>
  );
}

export function SkeletonRows({ count = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}

/** A small fixed-width card (bank account card on Home). */
export function SkeletonStatCard({ w = 165 }) {
  return (
    <div style={{ ...CARD, flex: '0 0 auto', width: w, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Skeleton w={40} h={40} r={13} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <SkeletonText w="70%" h={12} />
          <SkeletonText w="45%" h={9} />
        </div>
      </div>
      <div style={{ marginTop: 16 }}><SkeletonNumber w={100} h={20} /></div>
      <div style={{ marginTop: 12 }}><SkeletonText w="50%" h={9} /></div>
    </div>
  );
}

const PAD = { padding: '8px 18px 24px' };

/** Home: hero balance, account cards row, a panel, quick actions. */
export function DashboardSkeleton() {
  return (
    <div style={PAD}>
      <div style={{ borderRadius: 30, padding: '24px 24px 26px', background: '#efeafb' }}>
        <Skeleton w={120} h={14} r={7} />
        <div style={{ marginTop: 16 }}><Skeleton w={90} h={11} r={6} /></div>
        <div style={{ marginTop: 12 }}><Skeleton w={210} h={42} r={10} /></div>
        <div style={{ marginTop: 16 }}><Skeleton w={140} h={12} r={7} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 4px 12px' }}>
        <Skeleton w={130} h={18} r={8} /><Skeleton w={54} h={12} r={7} />
      </div>
      <div style={{ display: 'flex', gap: 13, overflow: 'hidden' }}>
        <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
      </div>
      <div style={{ ...CARD, borderRadius: 28, padding: 22, marginTop: 20 }}>
        <SkeletonText w="40%" h={15} />
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton h={14} r={20} /><Skeleton h={14} r={20} />
        </div>
      </div>
      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Skeleton w={58} h={58} r={20} /><SkeletonText w={42} h={9} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Transactions: overview card, quick-add, search, segments, then rows. */
export function TransactionsSkeleton() {
  return (
    <div style={PAD}>
      <div style={{ margin: '6px 4px 16px' }}><Skeleton w={180} h={25} r={8} /></div>
      <div style={{ ...CARD, borderRadius: 26, padding: 20 }}>
        <div style={{ display: 'flex', gap: 11 }}>
          <Skeleton h={62} r={18} /><Skeleton h={62} r={18} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Skeleton h={44} r={16} /><Skeleton h={44} r={16} /><Skeleton h={44} r={16} />
      </div>
      <div style={{ marginTop: 16 }}><Skeleton h={46} r={18} /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <SkeletonChip w={70} /><SkeletonChip w={90} /><SkeletonChip w={80} /><SkeletonChip w={80} />
      </div>
      <div style={{ marginTop: 22 }}><SkeletonRows count={6} /></div>
    </div>
  );
}

/** Auto-track: connection card + a couple of review cards. */
export function EmailConnectSkeleton() {
  return (
    <div style={PAD}>
      <div style={{ margin: '6px 4px 18px' }}><Skeleton w={150} h={25} r={8} /></div>
      <div style={{ ...CARD, padding: '18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton w={46} h={46} r={14} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonText w="40%" h={14} /><SkeletonText w="65%" h={11} />
          </div>
          <SkeletonChip w={84} h={26} />
        </div>
        <div style={{ marginTop: 13 }}><Skeleton h={46} r={14} /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Skeleton h={42} r={14} /><Skeleton w={110} h={42} r={14} />
        </div>
      </div>
      <div style={{ margin: '26px 4px 14px' }}><Skeleton w={200} h={12} r={7} /></div>
      <SkeletonRows count={4} />
    </div>
  );
}

/** Invest: portfolio hero + holding sections. */
export function InvestmentsSkeleton() {
  return (
    <div style={PAD}>
      <div style={{ margin: '6px 4px 16px' }}><Skeleton w={170} h={25} r={8} /></div>
      <div style={{ borderRadius: 28, padding: 24, background: '#eef0f7' }}>
        <Skeleton w={130} h={12} r={7} />
        <div style={{ marginTop: 12 }}><Skeleton w={190} h={34} r={9} /></div>
        <div style={{ marginTop: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
          <SkeletonCircle d={110} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 13 }}>
            <SkeletonText w="70%" /><SkeletonText w="55%" /><SkeletonText w="60%" />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 22 }}><SkeletonRows count={4} /></div>
    </div>
  );
}

/** Discover: title, a couple of section headers + rows. */
export function DiscoverSkeleton() {
  return (
    <div style={PAD}>
      <div style={{ margin: '6px 4px 18px' }}><Skeleton w={150} h={25} r={8} /></div>
      <div style={{ ...CARD, borderRadius: 24, padding: 18 }}>
        <SkeletonText w="45%" h={14} />
        <div style={{ marginTop: 14 }}><SkeletonRows count={3} /></div>
      </div>
      <div style={{ margin: '26px 4px 13px' }}><Skeleton w={160} h={17} r={8} /></div>
      <SkeletonRows count={4} />
    </div>
  );
}

/** A single goal card placeholder: icon circle, title + amount line, progress bar, buttons. */
export function SkeletonGoalCard() {
  return (
    <div style={{ borderRadius: 24, padding: 18, background: '#fff', border: '1.5px solid #f1ecf6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Skeleton w={46} h={46} r={15} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonText w="55%" h={14} />
          <SkeletonText w="40%" h={11} />
        </div>
        <SkeletonNumber w={42} h={16} />
      </div>
      <div style={{ marginTop: 14 }}><Skeleton h={11} r={20} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <Skeleton h={38} r={13} style={{ flex: 1 }} />
        <Skeleton w={62} h={38} r={13} />
        <Skeleton w={48} h={38} r={13} />
      </div>
    </div>
  );
}

/** Goals section (Discover "Your goals"): header + a few goal cards. */
export function GoalsSkeleton({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonGoalCard key={i} />)}
    </div>
  );
}

/** Reports: header + period chips, summary card, donut+list, then lists. */
export function ReportsSkeleton() {
  return (
    <div style={PAD}>
      <div style={{ margin: '6px 4px 14px' }}><Skeleton w={150} h={25} r={8} /></div>
      <div style={{ display: 'flex', gap: 8, overflow: 'hidden', marginBottom: 16 }}>
        <SkeletonChip w={90} /><SkeletonChip w={90} /><SkeletonChip w={110} /><SkeletonChip w={80} />
      </div>
      <div style={{ ...CARD, borderRadius: 26, padding: 22 }}>
        <SkeletonText w="35%" h={11} />
        <div style={{ marginTop: 12 }}><Skeleton w={170} h={34} r={9} /></div>
        <div style={{ marginTop: 16, display: 'flex', gap: 11 }}>
          <Skeleton h={56} r={16} /><Skeleton h={56} r={16} /><Skeleton h={56} r={16} />
        </div>
      </div>
      <div style={{ ...CARD, borderRadius: 26, padding: 22, marginTop: 16 }}>
        <SkeletonText w="45%" h={14} />
        <div style={{ marginTop: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
          <SkeletonCircle d={120} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonText w="80%" /><SkeletonText w="65%" /><SkeletonText w="70%" /><SkeletonText w="55%" />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 22 }}><SkeletonRows count={4} /></div>
    </div>
  );
}
