export type Language = 'en' | 'de' | 'fr' | 'es';

export const translations = {
    "dashboard": {
        "en": "Dashboard",
        "de": "Instrumententafel",
        "fr": "Tableau de bord",
        "es": "Tablero"
    },
    "settings": {
        "en": "Settings",
        "de": "Einstellungen",
        "fr": "Paramètres",
        "es": "Ajustes"
    },
    "account": {
        "en": "Account",
        "de": "Konto",
        "fr": "Compte",
        "es": "Cuenta"
    },
    "profile": {
        "en": "Profile",
        "de": "Profil",
        "fr": "Profil",
        "es": "Perfil"
    },
    "logout": {
        "en": "Logout",
        "de": "Abmelden",
        "fr": "Déconnexion",
        "es": "Cerrar sesión"
    },
    "home": {
        "en": "Home",
        "de": "Startseite",
        "fr": "Accueil",
        "es": "Inicio"
    },
    "remote_support": {
        "en": "Remote Support",
        "de": "Fernunterstützung",
        "fr": "Support à distance",
        "es": "Soporte remoto"
    },
    "devices": {
        "en": "Devices",
        "de": "Geräte",
        "fr": "Appareils",
        "es": "Dispositivos"
    },
    "chat": {
        "en": "Chat",
        "de": "Chat",
        "fr": "Chat",
        "es": "Chat"
    },
    "notifications": {
        "en": "Notifications",
        "de": "Benachrichtigungen",
        "fr": "Notifications",
        "es": "Notificaciones"
    },
    "admin_settings": {
        "en": "Admin settings",
        "de": "Admin-Einstellungen",
        "fr": "Paramètres admin",
        "es": "Ajustes de admin"
    },
    "feedback": {
        "en": "Feedback",
        "de": "Feedback",
        "fr": "Commentaires",
        "es": "Comentarios"
    },
    "help": {
        "en": "Help",
        "de": "Hilfe",
        "fr": "Aide",
        "es": "Ayuda"
    },
    "more_solutions": {
        "en": "More solutions",
        "de": "Weitere Lösungen",
        "fr": "Plus de solutions",
        "es": "Más soluciones"
    },
    "ready_to_connect": {
        "en": "Ready to connect",
        "de": "Bereit zum Verbinden",
        "fr": "Prêt à se connecter",
        "es": "Listo para conectar"
    },
    "edit_profile": {
        "en": "Edit profile",
        "de": "Profil bearbeiten",
        "fr": "Modifier le profil",
        "es": "Editar perfil"
    },
    "management_console": {
        "en": "Management Console",
        "de": "Management-Konsole",
        "fr": "Console de gestion",
        "es": "Consola de gestión"
    },
    "personal_settings": {
        "en": "Personal Settings",
        "de": "Persönliche Einstellungen",
        "fr": "Paramètres personnels",
        "es": "Ajustes personales"
    },
    "avatar": {
        "en": "Avatar",
        "de": "Avatar",
        "fr": "Avatar",
        "es": "Avatar"
    },
    "language": {
        "en": "Language",
        "de": "Sprache",
        "fr": "Langue",
        "es": "Idioma"
    },
    "save_changes": {
        "en": "Save Changes",
        "de": "Änderungen speichern",
        "fr": "Enregistrer les modifications",
        "es": "Guardar cambios"
    },
    "welcome_back": {
        "en": "Welcome back",
        "de": "Willkommen zurück",
        "fr": "Bon retour",
        "es": "Bienvenido de nuevo"
    }
};

export const t = (key: string, lang?: string): string => {
    const k = key as keyof typeof translations;
    const l = (lang && ['en', 'de', 'fr', 'es'].includes(lang) ? lang : 'en') as Language;
    if (translations[k]) {
        return translations[k][l] || translations[k]['en'];
    }
    return key;
};
