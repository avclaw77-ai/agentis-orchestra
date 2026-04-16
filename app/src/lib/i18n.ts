/**
 * Bilingual i18n system for AgentisOrchestra.
 *
 * Supports EN and Quebec FR natively (not translated -- written naturally).
 * Uses cookie-based locale persistence and interpolation with {{var}} syntax.
 */

import { useCallback } from "react"

// =============================================================================
// Types
// =============================================================================

type Locale = "en" | "fr"

// =============================================================================
// Translation dictionaries
// =============================================================================

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Shell / Navigation
    "nav.dashboard": "Dashboard",
    "nav.chat": "Chat",
    "nav.tasks": "Tasks",
    "nav.goals": "Goals",
    "nav.routines": "Routines",
    "nav.models": "Models",
    "nav.costs": "Costs",
    "nav.settings": "Settings",

    // Department selector
    "dept.ceo_view": "CEO View",
    "dept.all_depts": "All departments",

    // Agent roster
    "agents.team": "Agent Team",
    "agents.idle": "Idle",
    "agents.active": "Active",
    "agents.thinking": "Thinking",

    // Tasks
    "tasks.backlog": "Backlog",
    "tasks.in_progress": "In Progress",
    "tasks.review": "Review",
    "tasks.done": "Done",
    "tasks.new": "New Task",
    "tasks.no_tasks": "No tasks",
    "tasks.checkout_locked": "Checked out",

    // Chat
    "chat.placeholder": "Message {{agent}}...",
    "chat.typing": "typing...",
    "chat.start_conversation": "Start a conversation with {{agent}}",

    // Heartbeat
    "heartbeat.when": "When should {{agent}} check in?",
    "heartbeat.chat_only": "Only when I message (chat only)",
    "heartbeat.scheduled": "On a schedule",
    "heartbeat.events": "On events",
    "heartbeat.next_runs": "Next runs",
    "heartbeat.coming_soon": "Coming soon",

    // Costs
    "costs.monthly_overview": "Monthly Overview",
    "costs.spent": "Spent",
    "costs.tasks_completed": "Tasks Completed",
    "costs.runs": "Runs",
    "costs.cli_savings": "CLI Savings",
    "costs.by_department": "By Department",
    "costs.by_model": "By Model",
    "costs.budget_status": "Budget Status",

    // Goals
    "goals.company_mission": "Company Mission",
    "goals.add_goal": "Add Goal",
    "goals.no_goals": "No goals yet",

    // Approvals
    "approvals.pending": "Pending",
    "approvals.all": "All",
    "approvals.approve": "Approve",
    "approvals.reject": "Reject",
    "approvals.revision": "Request Revision",

    // Routines
    "routines.new": "New Routine",
    "routines.trigger_now": "Trigger Now",
    "routines.activate": "Activate",
    "routines.pause": "Pause",

    // Settings
    "settings.general": "General",
    "settings.approvals": "Approvals",
    "settings.skills": "Skills",
    "settings.plugins": "Plugins",
    "settings.export_import": "Export / Import",
    "settings.company_name": "Company Name",
    "settings.language": "Language",

    // Plugins
    "plugins.title": "Plugins",
    "plugins.installed": "{{count}} installed",
    "plugins.no_plugins": "No plugins installed. Drop plugin folders into the plugins/ directory.",
    "plugins.restart": "Restart",
    "plugins.install": "Install Plugin",
    "plugins.install_path": "Plugin directory path",
    "plugins.status_ready": "Ready",
    "plugins.status_error": "Error",
    "plugins.status_stopped": "Stopped",
    "plugins.status_loading": "Loading",
    "plugins.crashes": "{{count}} crashes",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.create": "Create",
    "common.edit": "Edit",
    "common.close": "Close",
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.success": "Success",
    "common.connected": "Connected",
  },
  fr: {
    // Shell / Navigation
    "nav.dashboard": "Tableau de bord",
    "nav.chat": "Chat",
    "nav.tasks": "Taches",
    "nav.goals": "Objectifs",
    "nav.routines": "Routines",
    "nav.models": "Modeles",
    "nav.costs": "Couts",
    "nav.settings": "Parametres",

    // Department selector
    "dept.ceo_view": "Vue PDG",
    "dept.all_depts": "Tous les departements",

    // Agent roster
    "agents.team": "Equipe d'agents",
    "agents.idle": "Inactif",
    "agents.active": "Actif",
    "agents.thinking": "En reflexion",

    // Tasks
    "tasks.backlog": "A faire",
    "tasks.in_progress": "En cours",
    "tasks.review": "En revision",
    "tasks.done": "Termine",
    "tasks.new": "Nouvelle tache",
    "tasks.no_tasks": "Aucune tache",
    "tasks.checkout_locked": "En traitement",

    // Chat
    "chat.placeholder": "Message a {{agent}}...",
    "chat.typing": "en cours...",
    "chat.start_conversation": "Commencer une conversation avec {{agent}}",

    // Heartbeat
    "heartbeat.when": "Quand {{agent}} devrait-il se manifester?",
    "heartbeat.chat_only": "Seulement quand je lui ecris",
    "heartbeat.scheduled": "Selon un horaire",
    "heartbeat.events": "Sur evenements",
    "heartbeat.next_runs": "Prochaines executions",
    "heartbeat.coming_soon": "Bientot disponible",

    // Costs
    "costs.monthly_overview": "Apercu mensuel",
    "costs.spent": "Depense",
    "costs.tasks_completed": "Taches completees",
    "costs.runs": "Executions",
    "costs.cli_savings": "Economies CLI",
    "costs.by_department": "Par departement",
    "costs.by_model": "Par modele",
    "costs.budget_status": "Etat du budget",

    // Goals
    "goals.company_mission": "Mission de l'entreprise",
    "goals.add_goal": "Ajouter un objectif",
    "goals.no_goals": "Aucun objectif pour le moment",

    // Approvals
    "approvals.pending": "En attente",
    "approvals.all": "Tous",
    "approvals.approve": "Approuver",
    "approvals.reject": "Rejeter",
    "approvals.revision": "Demander revision",

    // Routines
    "routines.new": "Nouvelle routine",
    "routines.trigger_now": "Executer maintenant",
    "routines.activate": "Activer",
    "routines.pause": "Mettre en pause",

    // Settings
    "settings.general": "General",
    "settings.approvals": "Approbations",
    "settings.skills": "Competences",
    "settings.plugins": "Extensions",
    "settings.export_import": "Exporter / Importer",
    "settings.company_name": "Nom de l'entreprise",
    "settings.language": "Langue",

    // Plugins
    "plugins.title": "Extensions",
    "plugins.installed": "{{count}} installees",
    "plugins.no_plugins":
      "Aucune extension installee. Deposez les dossiers d'extensions dans le repertoire plugins/.",
    "plugins.restart": "Redemarrer",
    "plugins.install": "Installer une extension",
    "plugins.install_path": "Chemin du dossier d'extension",
    "plugins.status_ready": "Pret",
    "plugins.status_error": "Erreur",
    "plugins.status_stopped": "Arrete",
    "plugins.status_loading": "Chargement",
    "plugins.crashes": "{{count}} plantages",

    // Common
    "common.save": "Sauvegarder",
    "common.cancel": "Annuler",
    "common.delete": "Supprimer",
    "common.create": "Creer",
    "common.edit": "Modifier",
    "common.close": "Fermer",
    "common.loading": "Chargement...",
    "common.error": "Erreur",
    "common.success": "Succes",
    "common.connected": "Connecte",
  },
}

// =============================================================================
// Locale detection
// =============================================================================

export function useLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = document.cookie.match(/ao_locale=(en|fr)/)?.[1]
    if (stored) return stored as Locale
  }
  return "en"
}

export function setLocale(locale: Locale): void {
  if (typeof window !== "undefined") {
    document.cookie = `ao_locale=${locale};path=/;max-age=${365 * 24 * 60 * 60}`
  }
}

// =============================================================================
// Translation function
// =============================================================================

export function t(locale: Locale, key: string, vars?: Record<string, string>): string {
  let str = translations[locale]?.[key] || translations.en[key] || key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v)
    }
  }
  return str
}

// =============================================================================
// React hook: useT -- returns a bound t() function
// =============================================================================

export function useT(): (key: string, vars?: Record<string, string>) => string {
  const locale = useLocale()
  return useCallback(
    (key: string, vars?: Record<string, string>) => t(locale, key, vars),
    [locale]
  )
}

// =============================================================================
// Exports
// =============================================================================

export type { Locale }
export { translations }
