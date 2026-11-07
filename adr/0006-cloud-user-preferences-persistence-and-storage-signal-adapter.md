# ADR 0006: Persistance Cloud des Préférences Utilisateur et Adaptateur Transparent storageSignal

- **Statut** : Proposé
- **Date** : 2026-11-07
- **Auteurs** : Antigravity & Équipe Roadmap

## Contexte

Dans Roadmap, les filtres et réglages d'affichage (zoom, mode de vue, thème, version consultée des release notes) étaient gérés de manière fragmentée et éphémère dans le `localStorage` du navigateur. Ce stockage local empêchait la restitution des réglages lors du changement de poste ou après le nettoyage automatique du navigateur par les stratégies d'entreprise (GPO).
Par ailleurs, les composants consommateurs utilisaient déjà largement la fonction utilitaire `storageSignal<T>()`. Une refactorisation intégrale de tous les composants consommateurs aurait été invasive et source de régressions.

## Décisions

1. **Table Centralisée `public.roadmap_user_preferences`** :
   - Stockage d'un document JSONB unique par utilisateur (`user_id` clé primaire liée à `auth.users`), protégé par RLS.
   - Constante centralisée `DB_TABLES.USER_PREFERENCES` dans `src/constants/db-tables.ts`.
2. **Service Dédié `PreferencesService` avec Debounce et Keepalive** :
   - Signal réactif d'état `preferences()`.
   - Mises à jour optimistes en mémoire et synchronisation miroir dans `localStorage` au premier paint.
   - Synchronisation vers Supabase différée de 1.5 seconde (debounce) pour absorber les frappes clavier ou les modifications rapides.
   - Utilisation de `fetch(..., { keepalive: true })` sur l'événement `pagehide` pour garantir la persistance lors de la fermeture d'onglet.
3. **Pattern Adaptateur Transparent dans `storageSignal`** :
   - Injection optionnelle de `PreferencesService` dans `storageSignal`.
   - Table de correspondance entre les clés historiques (ex: `plan-view-zoom-level`, `capacity-view-selected-teams`) et les propriétés JSONB.
   - Aucune modification requise au sein des composants existants utilisant `storageSignal`.
4. **Densités par Défaut Compactes** :
   - Initialisation par défaut de la densité de Planification et de Capacité à `'compact'` au lieu de `'normal'`.
5. **Priorité des Paramètres d'URL (Query Params)** :
   - Pour les liens profonds ou ciblés (ex: vers un projet depuis le Dashboard), les query params ont priorité sur les filtres enregistrés.

## Conséquences

- **Positives** :
  - Continuité de l'expérience utilisateur quel que soit le poste ou le navigateur utilisé.
  - Zéro latence perçue et robustesse en cas de perte de connectivité temporaire.
  - Préservation intégrale du code des composants existants grâce à l'adaptateur `storageSignal`.
  - Affichage optimisé et compact dès la première visite sur les vues denses.
- **Négatives / Compromis** :
  - Nécessite la création de la table Supabase et l'application des politiques RLS préalablement au déploiement applicatif.
