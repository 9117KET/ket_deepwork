/**
 * contexts/LanguageContext.tsx
 *
 * Very small i18n layer for the app. Keeps the current language
 * (English, German, French) and exposes a t() helper for common UI strings.
 * This intentionally focuses on high-level shell copy and key planner labels.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Language = 'en' | 'de' | 'fr'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'app.tagline': 'Daily focus hub for everything.',
    'app.loading': 'Loading your workspace...',
    'app.viewProgress': 'View progress',
    'app.signOut': 'Sign out',
    'app.languageLabel': 'Language',

    'login.subtitle': 'Sign in to sync your planner across devices, or continue as a guest.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.passwordPlaceholder': 'At least 6 characters',
    'login.error.empty': 'Please enter both email and password.',
    'login.error.shortPassword': 'Password should be at least 6 characters.',
    'login.error.generic': 'Authentication failed. Please try again.',
    'login.info.signupCreated':
      'Account created. You may need to confirm your email depending on project settings, then sign in.',
    'login.submit.signIn': 'Sign in',
    'login.submit.signInLoading': 'Signing in...',
    'login.submit.signUp': 'Create account',
    'login.submit.signUpLoading': 'Creating account...',
    'login.toggle.toSignup': "Don\u2019t have an account? Sign up",
    'login.toggle.toSignin': 'Already have an account? Sign in',
    'login.guest': 'Continue as guest',

    'planner.timeOffset.label':
      'Daily timeframe offset (defaults: 5–9 morning, 9–5 focus, 5–9 evening).',
    'planner.timeOffset.status.default': 'Using default blocks. Shift by ±30 minutes as needed.',
    'planner.timeOffset.status.shifted': 'Shifted by {minutes} minutes from the default blocks.',
    'planner.selectedCount': 'selected',
    'planner.selected.clear': 'Clear selection',
    'planner.selected.delete': 'Delete selected',

    'weekly.title': 'Progress',
    'weekly.subtitle': 'Day · Week · Month · Year overview of your tasks.',
    'weekly.day.noTasks':
      'You haven\u2019t planned any tasks for today yet. Add your 3 must-dos and let the day flow from there.',
    'weekly.day.summary':
      "You're {percentage}% done with today's tasks ({completed}/{total}). Nice work. Keep your focus blocks honest and kind to yourself.",
    'weekly.week.summary':
      "This week you've completed {completed} of {total} planned tasks. Keep stacking small wins.",
    'weekly.month.summary':
      "This month you're at {percentage}% completion ({completed}/{total} tasks).",
    'weekly.year.summary':
      "This year you've finished {completed} of {total} tasks you planned.",
  },
  de: {
    'app.tagline': 'Täglicher Fokus-Hub für alles.',
    'app.loading': 'Dein Arbeitsbereich wird geladen...',
    'app.viewProgress': 'Fortschritt anzeigen',
    'app.signOut': 'Abmelden',
    'app.languageLabel': 'Sprache',

    'login.subtitle':
      'Melde dich an, um deinen Planer über Geräte hinweg zu synchronisieren, oder fahre als Gast fort.',
    'login.email': 'E-Mail',
    'login.password': 'Passwort',
    'login.passwordPlaceholder': 'Mindestens 6 Zeichen',
    'login.error.empty': 'Bitte gib sowohl E-Mail als auch Passwort ein.',
    'login.error.shortPassword': 'Das Passwort sollte mindestens 6 Zeichen haben.',
    'login.error.generic': 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
    'login.info.signupCreated':
      'Konto erstellt. Je nach Projekteinstellungen musst du deine E-Mail bestätigen und dich dann erneut anmelden.',
    'login.submit.signIn': 'Anmelden',
    'login.submit.signInLoading': 'Anmeldung...',
    'login.submit.signUp': 'Konto erstellen',
    'login.submit.signUpLoading': 'Konto wird erstellt...',
    'login.toggle.toSignup': 'Noch kein Konto? Registrieren',
    'login.toggle.toSignin': 'Bereits ein Konto? Anmelden',
    'login.guest': 'Als Gast fortfahren',

    'planner.timeOffset.label':
      'Tages-Zeitfenster-Verschiebung (Standard: 5–9 Morgen, 9–17 Fokus, 17–21 Abend).',
    'planner.timeOffset.status.default':
      'Standardblöcke aktiv. Nach Bedarf in Schritten von ±30 Minuten verschieben.',
    'planner.timeOffset.status.shifted':
      'Um {minutes} Minuten gegenüber den Standardblöcken verschoben.',
    'planner.selectedCount': 'ausgewählt',
    'planner.selected.clear': 'Auswahl löschen',
    'planner.selected.delete': 'Ausgewählte löschen',

    'weekly.title': 'Fortschritt',
    'weekly.subtitle': 'Tages-, Wochen-, Monats- und Jahresübersicht deiner Aufgaben.',
    'weekly.day.noTasks':
      'Du hast für heute noch keine Aufgaben geplant. Lege deine 3 wichtigsten Aufgaben fest und baue den Tag darum herum auf.',
    'weekly.day.summary':
      'Du bist zu {percentage}% mit den heutigen Aufgaben fertig ({completed}/{total}). Gute Arbeit – bleib ehrlich und freundlich zu dir selbst.',
    'weekly.week.summary':
      'Diese Woche hast du {completed} von {total} geplanten Aufgaben erledigt. Kleine Schritte zählen.',
    'weekly.month.summary':
      'Diesen Monat liegst du bei {percentage}% ({completed}/{total} Aufgaben).',
    'weekly.year.summary':
      'Dieses Jahr hast du {completed} von {total} geplanten Aufgaben abgeschlossen.',
  },
  fr: {
    'app.tagline': 'Centre de focus quotidien pour tout.',
    'app.loading': 'Chargement de votre espace de travail...',
    'app.viewProgress': 'Voir la progression',
    'app.signOut': 'Se déconnecter',
    'app.languageLabel': 'Langue',

    'login.subtitle':
      "Connectez-vous pour synchroniser votre planificateur sur vos appareils, ou continuez en tant qu'invité.",
    'login.email': 'E-mail',
    'login.password': 'Mot de passe',
    'login.passwordPlaceholder': 'Au moins 6 caractères',
    'login.error.empty': 'Veuillez saisir à la fois votre e-mail et votre mot de passe.',
    'login.error.shortPassword': 'Le mot de passe doit contenir au moins 6 caractères.',
    'login.error.generic': "Échec de l’authentification. Veuillez réessayer.",
    'login.info.signupCreated':
      'Compte créé. Selon la configuration du projet, vous devrez peut-être confirmer votre e-mail puis vous reconnecter.',
    'login.submit.signIn': 'Se connecter',
    'login.submit.signInLoading': 'Connexion...',
    'login.submit.signUp': 'Créer un compte',
    'login.submit.signUpLoading': 'Création du compte...',
    'login.toggle.toSignup': "Pas de compte ? Inscrivez-vous",
    'login.toggle.toSignin': 'Vous avez déjà un compte ? Connectez-vous',
    'login.guest': 'Continuer comme invité',

    'planner.timeOffset.label':
      'Décalage des plages horaires quotidiennes (par défaut : 5–9 matin, 9–17 focus, 17–21 soir).',
    'planner.timeOffset.status.default':
      'Plages par défaut utilisées. Ajustez par pas de ±30 minutes si nécessaire.',
    'planner.timeOffset.status.shifted':
      'Décalé de {minutes} minutes par rapport aux plages par défaut.',
    'planner.selectedCount': 'sélectionné(s)',
    'planner.selected.clear': 'Effacer la sélection',
    'planner.selected.delete': 'Supprimer la sélection',

    'weekly.title': 'Progression',
    'weekly.subtitle':
      'Vue Jour · Semaine · Mois · Année de vos tâches.',
    'weekly.day.noTasks':
      "Vous n'avez pas encore planifié de tâches pour aujourd'hui. Choisissez vos 3 priorités et construisez votre journée autour.",
    'weekly.day.summary':
      "Vous avez réalisé {percentage}% des tâches d'aujourd'hui ({completed}/{total}). Beau travail – restez honnête et bienveillant avec vous-même.",
    'weekly.week.summary':
      'Cette semaine, vous avez terminé {completed} tâches sur {total} prévues. Les petits pas comptent.',
    'weekly.month.summary':
      'Ce mois-ci, vous êtes à {percentage}% ({completed}/{total} tâches).',
    'weekly.year.summary':
      'Cette année, vous avez terminé {completed} tâches sur {total} planifiées.',
  },
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(`{${key}}`, String(value))
  }, template)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')

  const value: LanguageContextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) => {
        const table = TRANSLATIONS[language] ?? TRANSLATIONS.en
        return table[key] ?? TRANSLATIONS.en[key] ?? key
      },
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return ctx
}

export { interpolate }

