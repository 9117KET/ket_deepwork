export type MobileTab = 'plan' | 'timer' | 'habits' | 'stats'

interface MobileTabBarProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'timer', label: 'Timer' },
  { id: 'habits', label: 'Habits' },
  { id: 'stats', label: 'Stats' },
]

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm lg:hidden">
      <div className="flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-1 items-center justify-center py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? '-mt-px border-t-2 border-sky-500 text-sky-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
