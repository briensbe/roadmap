/**
 * ==============================================================================
 * Roadmap - Modèle de Configuration d'Environnement (Template)
 * ==============================================================================
 *
 * Ce fichier sert de modèle pour configurer vos environnements locaux et de production.
 *
 * INSTRUCTIONS DE DÉMARRAGE :
 * 1. Dupliquez ce fichier et renommez la copie selon votre cible :
 *    - Pour le développement local : `src/environments/environment.ts`
 *    - Pour la production          : `src/environments/environment.prod.ts`
 * 2. Renseignez les variables requises (notamment l'URL et la clé publique Supabase).
 * 3. Ne commitez JAMAIS vos fichiers `environment.ts` ou `.env` contenant de vrais secrets.
 *
 * ==============================================================================
 */

export const environment = {
  /**
   * Mode de compilation / exécution.
   * - `false` : Mode développement (logs détaillés, rechargement à chaud).
   * - `true`  : Mode production (optimisations de build Angular, minification).
   */
  production: false,

  /**
   * Activation globale du module d'authentification.
   * - `true`  : L'application exige une session utilisateur valide pour accéder aux vues.
   * - `false` : Mode ouvert / bypass d'authentification pour le développement rapide.
   */
  enableAuth: true,

  /**
   * Activation du fournisseur d'authentification Google OAuth.
   * - `true`  : Affiche le bouton « Continuer avec Google » et active le flux OAuth.
   * - `false` : Masque les options Google et restreint l'authentification à l'e-mail/mot de passe.
   */
  enableGoogleAuth: false,

  /**
   * URL de redirection après un flux d'authentification externe, une confirmation par e-mail
   * ou une réinitialisation de mot de passe.
   * - Développement local : 'http://localhost:4200'
   * - Production          : 'https://votre-domaine.com' ou 'https://organisation.github.io/roadmap'
   */
  authRedirectUrl: 'http://localhost:4200',

  /**
   * Liste des domaines d'adresses e-mail autorisés lors de l'inscription (création de compte).
   * - `[]`                          : Aucun filtrage, toutes les adresses e-mail valides sont acceptées.
   * - `['mon-entreprise.com']`      : Seules les adresses se terminant par `@mon-entreprise.com` peuvent créer un compte.
   * - `['societe.fr', 'filiale.com']` : Support multi-domaines (insensible à la casse).
   */
  allowedEmailDomains: [
    // 'mon-entreprise.com',
  ] as string[],

  /**
   * URL de l'instance Supabase (Backend as a Service).
   * - Instance locale Docker : 'http://localhost:60000' ou 'http://127.0.0.1:54321'
   * - Instance Cloud         : 'https://<votre-id-projet>.supabase.co'
   */
  supabaseUrl: 'http://localhost:60000',

  /**
   * Clé d'API publique Supabase (Clé "anon" / "publishable").
   * Cette clé est sécurisée côté client grâce aux politiques Row Level Security (RLS) de PostgreSQL.
   * ATTENTION : Ne JAMAIS utiliser la clé "service_role" (secrète) dans le front-end !
   */
  supabaseKey: 'VOTRE_CLE_PUBLIQUE_SUPABASE_ANON',

  /**
   * Token du tableau de feedback Canny.io (optionnel).
   * Utilisé pour intégrer la boîte à idées et le recueil des retours utilisateurs dans l'application.
   */
  cannyBoardToken: 'VOTRE_CANNY_BOARD_TOKEN_OPTIONNEL',

  /**
   * URL du script Issue Collector Jira Atlassian (optionnel).
   * Permet aux utilisateurs de remonter des anomalies ou suggestions directement dans votre projet Jira.
   * Laissez vide ou commentez si vous n'utilisez pas Jira Collector.
   */
  jiraCollectorUrl: 'https://votre-domaine.atlassian.net/s/.../issuecollector.js?locale=fr-FR&collectorId=...',

  /**
   * Numéro de version ou tag de build de l'application affiché dans l'interface (ex: pied de page).
   */
  version: '2026.09.12-dev',
};
