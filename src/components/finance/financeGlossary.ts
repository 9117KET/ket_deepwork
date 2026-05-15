/**
 * components/finance/financeGlossary.ts
 *
 * German personal finance glossary.
 * Each term has a short tooltip definition and a longer explanation.
 */

export interface GlossaryTerm {
  id: string
  term: string
  shortDef: string
  /** Full explanation shown in the Learn section. May include examples. */
  fullDef: string
  /** Related term ids. */
  related?: string[]
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: 'girokonto',
    term: 'Girokonto',
    shortDef: 'German checking account - the hub for salary deposits and bill payments.',
    fullDef:
      'A Girokonto is a current account used for everyday transactions in Germany. Your salary lands here, your Lastschriften (direct debits) pull from here, and your Dauerauftrag (standing orders) push out from here. Best free options: DKB and ING, both with no monthly fees and good apps. Always keep a 2-4 week expense buffer to avoid touching the Dispo (overdraft).',
    related: ['tagesgeld', 'dispo', 'dauerauftrag'],
  },
  {
    id: 'tagesgeld',
    term: 'Tagesgeldkonto',
    shortDef: 'High-yield instant-access savings account. Money is available within 1-2 business days.',
    fullDef:
      'A Tagesgeldkonto pays daily interest on your balance and allows withdrawals within 1-2 business days - unlike Festgeld, it is not locked. Use it for your emergency fund (Notgroschen) and short-term savings goals. Best rates in 2025/26: Scalable Capital (2.5% p.a.) and various EU banks via Weltsparen/Raisin (up to 3.45% p.a.). German deposit insurance covers up to €100,000 per bank per person.',
    related: ['festgeld', 'notgroschen', 'freistellungsauftrag'],
  },
  {
    id: 'festgeld',
    term: 'Festgeld',
    shortDef: 'Fixed-term deposit with a locked interest rate. Higher rates than Tagesgeld but money is tied up.',
    fullDef:
      'Festgeld locks your money for a set term (3 months to 5+ years) in exchange for a higher interest rate. Ideal for money you will need in 1-3 years and want to earn more on without stock market risk. Best accessed via Raisin/Weltsparen which aggregates European bank offers. A 1-year Festgeld from a quality EU bank was yielding 2.5-3.2% p.a. in early 2026.',
    related: ['tagesgeld', 'raisin'],
  },
  {
    id: 'depot',
    term: 'Depot',
    shortDef: 'Brokerage/securities custody account where you hold ETFs, stocks, and bonds.',
    fullDef:
      'A Depot is the German equivalent of a brokerage account. It is separate from your Girokonto and holds your ETF and stock positions. Settlement goes through a linked cash account. Best free depots in 2025/26: Trade Republic (Sparplan from €1, 2% interest on cash, banking licence) and Scalable Capital (PRIME+ plan: €4.99/month, unlimited trades, 2.5% on cash).',
    related: ['etf', 'sparplan', 'freistellungsauftrag'],
  },
  {
    id: 'etf',
    term: 'ETF (Exchange-Traded Fund)',
    shortDef: 'A fund that tracks an index (e.g. MSCI World) and trades on a stock exchange like a share.',
    fullDef:
      'ETFs track a market index passively - they buy every company in the index proportionally. Because they do not have a manager trying to beat the market, fees are very low (0.07-0.22% annually for a world ETF). The evidence overwhelmingly shows most active fund managers underperform their index over 10+ years after fees. The recommended starting point for a German investor: Vanguard FTSE All-World (ISIN IE00BK5BQT80, accumulating, 0.22% TER) or iShares MSCI World (ISIN IE00B4L5Y983, accumulating, 0.20% TER).',
    related: ['sparplan', 'ter', 'vorabpauschale', 'freistellungsauftrag'],
  },
  {
    id: 'sparplan',
    term: 'ETF-Sparplan',
    shortDef: 'A monthly automatic ETF purchase plan. Set it once and it buys on the same date every month.',
    fullDef:
      'A Sparplan is the German version of dollar-cost averaging. You set a monthly amount (minimum €1 at Trade Republic), choose an ETF, pick an execution date, and the broker automatically buys for you every month. No action required after setup. This is the mechanism that turns automation into wealth - money is invested before you can spend it. Over time, you automatically buy more shares when prices are low and fewer when prices are high.',
    related: ['etf', 'dauerauftrag', 'depot'],
  },
  {
    id: 'freistellungsauftrag',
    term: 'Freistellungsauftrag',
    shortDef: 'Tax-free allowance: €1,000/year (€2,000 married) on investment income. Free money - set it up immediately.',
    fullDef:
      'The Freistellungsauftrag allows €1,000 of investment income per year (dividends, interest, capital gains) to be received tax-free. For married couples, the limit is €2,000 combined. You must actively file it at each bank or broker where you hold investments - it is not automatic. If you have multiple depots, split the €1,000 proportionally. A single person who earns exactly €1,000 in investment income saves €263.75 in Abgeltungssteuer. This is always the first step when opening any investment account.',
    related: ['abgeltungssteuer', 'depot', 'vorabpauschale'],
  },
  {
    id: 'abgeltungssteuer',
    term: 'Abgeltungssteuer',
    shortDef: 'German capital gains tax: 25% + 5.5% Soli = 26.375% flat rate on investment income.',
    fullDef:
      'Germany taxes dividends, interest, and realized capital gains at a flat 26.375% (25% base + 5.5% Solidaritätszuschlag). Church tax members add approximately 8-9% of the 25% base, bringing the total to ~27.82-28%. Unlike the US, Germany does not distinguish between short-term and long-term gains - the rate is the same regardless of how long you held the asset. German brokers withhold this automatically at source. The first €1,000 (or €2,000 for married couples) is sheltered by the Freistellungsauftrag.',
    related: ['freistellungsauftrag', 'vorabpauschale', 'guestimerpruefung'],
  },
  {
    id: 'vorabpauschale',
    term: 'Vorabpauschale',
    shortDef: 'Annual pre-tax on accumulating ETFs. A small annual tax even though no income was distributed.',
    fullDef:
      'Germany taxes accumulating ETFs annually via the Vorabpauschale - a "phantom income" mechanism to prevent indefinite tax deferral. Formula: ETF value on Jan 1 × 70% × Basiszins (2.53% for 2025) = Basisertrag. Then 30% of the Basisertrag is tax-free (Teilfreistellung for equity ETFs), so you pay Abgeltungssteuer on 70% of the Basisertrag. Example: €10,000 ETF → Basisertrag = €10,000 × 70% × 2.53% = €177.10 → taxable = €177.10 × 70% = €123.97 → tax ≈ €32.70. Your broker debits this from your cash account in January. It is subtracted from the tax due at sale to avoid double taxation.',
    related: ['abgeltungssteuer', 'freistellungsauftrag', 'etf'],
  },
  {
    id: 'bav',
    term: 'bAV (Betriebliche Altersvorsorge)',
    shortDef: 'Company pension via salary sacrifice. Employer must add at least 15% on top of your contribution.',
    fullDef:
      'The bAV (occupational pension) lets you convert gross salary into pension contributions (Entgeltumwandlung). The key advantage: contributions come from gross pay before income tax and social insurance, reducing your actual net cost significantly. Since 2019, employers must contribute at least 15% of your converted salary. Example: You contribute €200/month gross; employer adds €30; your actual net cost is ~€100-120 after tax savings. In 2025, contributions up to €604/month are income-tax-free (€7,248/year). Critical caveat: payouts in retirement are taxed as regular income AND subject to GKV contributions (~18-20%). Only maximize bAV beyond employer match if the math still works.',
    related: ['rurup', 'altersvorsorgedepot', 'rentenversicherung'],
  },
  {
    id: 'rurup',
    term: 'Rürup-Rente (Basisrente)',
    shortDef: 'Tax-deductible retirement account. Best for self-employed and high earners (marginal rate ≥ 42%).',
    fullDef:
      'The Rürup-Rente allows up to €29,344/year (2025) to be deducted from taxable income, saving income tax immediately. The "return" is highest for those in the top tax bracket (42%+): a €10,000 contribution saves ~€4,200 in taxes immediately. The major downside: the money is locked as a lifetime annuity - you cannot cash out, sell, or (mostly) inherit it. Payouts are taxed as regular income in retirement. For employees in lower tax brackets, a plain ETF-Sparplan usually wins after all fees and restrictions are factored in.',
    related: ['bav', 'altersvorsorgedepot'],
  },
  {
    id: 'altersvorsorgedepot',
    term: 'Altersvorsorgedepot',
    shortDef: 'New state-subsidized retirement depot launching January 2027. Replaces the old Riester system.',
    fullDef:
      'The Bundestag passed the Altersvorsorgedepot on March 27, 2026. It launches January 1, 2027 and replaces the old Riester-Rente. Key features: 50 cents of state subsidy per euro saved (up to €360/year in base subsidy), no capital guarantee requirement (can invest directly in ETFs), cost cap of 1% p.a. Unlike Riester, there is no guarantee requirement that forced money into low-yield insurance products. For 2026: singles and childless couples should wait for the new system rather than open a Riester. Families with multiple children may still benefit from child subsidies in the current Riester before the transition.',
    related: ['rurup', 'bav'],
  },
  {
    id: 'rentenversicherung',
    term: 'Rentenversicherung (Statutory Pension)',
    shortDef: 'Germany\'s mandatory state pension. 18.6% of salary split 50/50 employer/employee.',
    fullDef:
      'Every employee in Germany contributes 9.3% of their gross salary to the statutory pension (employer matches 9.3%). You earn Entgeltpunkte each year: earning the national average salary (≈€45,358 in 2025) gives you 1 point. Each point is worth €40.79/month in pension (July 2025 rate). 35 years at average salary = 35 points = €1,428/month gross. The statutory pension is designed as a base layer (1. Säule) - it will likely cover 40-50% of your pre-retirement income. Private saving (ETFs, bAV, Rürup) is essential to maintain your standard of living in retirement.',
    related: ['gkv', 'bav', 'fire'],
  },
  {
    id: 'gkv',
    term: 'GKV (Gesetzliche Krankenversicherung)',
    shortDef: 'Germany\'s public health insurance. Mandatory for those earning under €73,800/year gross.',
    fullDef:
      'GKV is the public health insurance system covering ~90% of Germans. Contribution rate: approximately 16.3% of gross salary total (employer pays half ≈8.15%, you pay ≈8.15%), capped at the contribution ceiling. Key advantages: family members insured for free (Familienversicherung) if earning under ~€505/month; coverage continues during unemployment via Arbeitslosengeld. For FIRE planning: minimum GKV contribution in early retirement is approximately €215-250/month even with minimal income. Withdrawing ETF gains above GKV thresholds can increase contributions significantly.',
    related: ['pkv', 'rentenversicherung', 'fire'],
  },
  {
    id: 'pkv',
    term: 'PKV (Private Krankenversicherung)',
    shortDef: 'Private health insurance. Available to those earning over €73,800/year gross or the self-employed.',
    fullDef:
      'PKV premiums are based on age at entry, health status, and chosen coverage level. A healthy 30-year-old might pay €350-500/month. The employer contributes up to ~€421/month (half of average GKV). The major risk: premiums increase substantially with age, and in retirement you pay the full premium yourself (no employer subsidy) - potentially €1,000+/month. For most employees planning early retirement, GKV is far more predictable. For the self-employed, PKV can be advantageous if income is high and health is good at entry.',
    related: ['gkv'],
  },
  {
    id: 'dispo',
    term: 'Dispo (Dispokredit)',
    shortDef: 'German overdraft facility on your Girokonto. Typically 9-12% APR - one of the most expensive credit products.',
    fullDef:
      'The Dispo is a pre-approved overdraft line on your Girokonto, typically 2-3x your monthly salary. It is extremely convenient and extremely expensive: interest rates of 9-12% APR are standard, compared to 0-0.5% savings rates. Many Germans treat the Dispo as a safety buffer instead of building an actual emergency fund. The correct approach: never use the Dispo. Build a 2-4 week buffer in your Girokonto and a 3-6 month emergency fund in a Tagesgeldkonto. If you currently have Dispo debt, it is the single highest-return investment you can make to pay it off immediately.',
    related: ['notgroschen', 'girokonto'],
  },
  {
    id: 'notgroschen',
    term: 'Notgroschen (Emergency Fund)',
    shortDef: 'Emergency cash buffer of 3-6 months of expenses. Held in a Tagesgeldkonto, never invested.',
    fullDef:
      'The Notgroschen is the foundation of financial security. Target: 3 months net expenses for employed people with GKV. Up to 6 months for the self-employed, PKV holders, or single-income households. Germany\'s social safety net (Kündigungsschutz, 12-24 months of Arbeitslosengeld I, GKV coverage during unemployment) reduces the required buffer compared to the US. Keep it in a Tagesgeldkonto earning 2-3% interest - not in your Girokonto (too tempting to spend) and never in your ETF depot (the market can be down 40% exactly when you need the money).',
    related: ['tagesgeld', 'dispo', 'gkv'],
  },
  {
    id: 'dauerauftrag',
    term: 'Dauerauftrag',
    shortDef: 'Standing order. An automatic recurring transfer between your own accounts on a fixed date.',
    fullDef:
      'A Dauerauftrag is a standing instruction to your bank to transfer a fixed amount to a specified account on the same date every month. This is the German automation mechanism for Ramit Sethi\'s "pay yourself first" principle. Set up Dauerauftrag for: emergency fund top-up (until fully funded), savings goals (vacation, down payment, etc.), and funding the settlement account for your ETF Sparplan. Once set up, the money moves before you can think about spending it.',
    related: ['sparplan', 'lastschrift', 'girokonto'],
  },
  {
    id: 'lastschrift',
    term: 'Lastschrift (Direct Debit)',
    shortDef: 'Direct debit authorization. A company pulls money from your account on a variable or fixed date.',
    fullDef:
      'A Lastschrift is an authorization for a company to pull payments from your Girokonto automatically. Unlike a Dauerauftrag (which you initiate), a Lastschrift is initiated by the payee. Used for: GKV contributions, rent (sometimes), phone/internet, insurance premiums, and utility bills. Automating these is step one: you can dispute incorrect Lastschriften within 8 weeks without needing a reason.',
    related: ['dauerauftrag', 'girokonto'],
  },
  {
    id: 'fire',
    term: 'FIRE (Financial Independence, Retire Early)',
    shortDef: 'Financial independence through high savings rate and index investing. Retire on passive income.',
    fullDef:
      'FIRE is a movement focused on reaching financial independence - a point where your investments generate enough passive income to cover your living expenses permanently. Key concepts: (1) FIRE number = annual expenses / Safe Withdrawal Rate. Example: €30,000/year expenses at 3.5% SWR = €857,000 FIRE number. (2) High savings rate: 25-50% of income rather than the conventional 10-15%. (3) Index ETF investing: low-cost passive funds that compound over decades. German FIRE is more complex than US FIRE due to: Abgeltungssteuer on withdrawals, GKV minimum contributions, no Roth IRA equivalent, and high cost-of-living cities.',
    related: ['swr', 'abgeltungssteuer', 'gkv', 'etf'],
  },
  {
    id: 'swr',
    term: 'SWR (Safe Withdrawal Rate)',
    shortDef: 'The % of your portfolio you can withdraw annually without running out of money in 30+ years.',
    fullDef:
      'The Safe Withdrawal Rate is based on historical research (Trinity Study) showing that a 4% annual withdrawal from a diversified stock/bond portfolio has historically lasted 30 years in most scenarios. For German investors: (1) Use 3.5% not 4% - you likely have a longer retirement horizon (40-50 years if you retire early), (2) Abgeltungssteuer reduces your effective withdrawal by 15-20% of the gain portion, so gross withdrawal must be higher. A practical German FIRE formula: required gross withdrawal = (annual expenses × 1.15) / 3.5% to account for taxes on gains.',
    related: ['fire', 'abgeltungssteuer'],
  },
  {
    id: 'guestimerpruefung',
    term: 'Günstigerprüfung',
    shortDef: 'Tax assessment where capital gains are taxed at your lower personal income rate instead of 26.375%.',
    fullDef:
      'Normally, investment income is taxed at 26.375% (Abgeltungssteuer) regardless of your overall income. However, if your total income in a year places you in a marginal tax bracket lower than 25%, you can request Günstigerprüfung on your tax return (Anlage KAP). The Finanzamt will then assess your capital gains at your lower personal rate. This is particularly relevant for early retirees with low income: a couple withdrawing €40,000/year from ETFs with no other income may pay 0-15% instead of 26.375%, saving thousands per year.',
    related: ['abgeltungssteuer', 'fire'],
  },
  {
    id: 'csp',
    term: 'Conscious Spending Plan (CSP)',
    shortDef: 'Ramit Sethi\'s alternative to budgeting: allocate money intentionally before spending, then spend guilt-free.',
    fullDef:
      'The Conscious Spending Plan replaces traditional budgeting with intentional pre-allocation. Instead of tracking every purchase and feeling guilty, you first move money into the right buckets automatically (savings, investments, fixed costs), then spend whatever remains however you like - no guilt, no tracking. The four buckets and target percentages of monthly net income: Fixed Costs (50-60%): rent, utilities, insurance, phone, food. Investments (10%+): ETF-Sparplan, bAV. Savings Goals (5-10%): named goals like vacation or down payment. Guilt-Free Spending (20-35%): anything you enjoy.',
    related: ['dauerauftrag', 'sparplan', 'fire'],
  },
  {
    id: 'ter',
    term: 'TER (Total Expense Ratio)',
    shortDef: 'Annual management fee for an ETF, expressed as a percentage of assets.',
    fullDef:
      'The TER (Total Expense Ratio) is the annual cost of owning an ETF, deducted automatically from the fund\'s value - you never see a bill. For a €10,000 ETF with 0.20% TER, you pay €20/year. Over 30 years, the difference between a 0.20% TER fund and a 1.0% TER fund on a €100,000 investment at 7% returns is over €100,000. Always choose the lowest TER fund that tracks the index you want. Reference: Vanguard FTSE All-World UCITS 0.22%, iShares Core MSCI World UCITS 0.20%, SPDR MSCI ACWI 0.12%.',
    related: ['etf', 'sparplan'],
  },
  {
    id: 'rich-life',
    term: 'Rich Life',
    shortDef: 'Ramit Sethi\'s concept: your personalized definition of what "rich" means to you, not a generic number.',
    fullDef:
      'The Rich Life framework starts from the question: "What does a rich life look like to you specifically?" Most people adopt a generic definition of success (big house, luxury car, designer clothes) without asking whether those things actually make them happy. Sethi argues that you should spend extravagantly on the things you love and cut ruthlessly on things you don\'t. The Rich Life vision comes before any financial mechanics - it defines what you are actually working toward. Common Rich Life components: freedom to travel whenever you want, time with family, a specific home environment, access to quality healthcare, ability to support parents, pursuing a passion project without financial stress.',
    related: ['csp'],
  },
]

/** Quick lookup by term id. */
export const GLOSSARY_MAP: Record<string, GlossaryTerm> = Object.fromEntries(
  GLOSSARY.map((t) => [t.id, t]),
)
