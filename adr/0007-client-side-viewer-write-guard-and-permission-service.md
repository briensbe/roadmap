# ADR 0007: Garde-Fou d'Écriture Côté Client pour le Rôle Viewer et PermissionService

- **Statut** : Accepté
- **Date** : 2026-11-08
- **Auteurs** : Antigravity & Équipe Roadmap

## Contexte

Dans le cadre du contrôle d'accès basé sur les rôles (RBAC), les utilisateurs enregistrés avec le rôle `viewer` dans `roadmap_user_profiles` bénéficient d'un accès légitime en consultation aux données de l'application (projets, planification, capacité).
Cependant, l'interface utilisateur présentait des contrôles d'édition interactifs (barre d'outils de sélection de charges, glisser-déposer de planification, actions de suppression et création de projets).
Bien que les politiques Row Level Security (RLS) de Supabase rejettent les requêtes d'écriture non autorisées, ces tentatives envoyaient des requêtes HTTP inutiles et provoquaient des erreurs réseau parasites.

## Décisions

1. **Centralisation dans `PermissionService` (Deep Module)** :
   - Création de `src/services/permission.service.ts` consommant le signal réactif `userRole` issu de `SupabaseService`.
   - Exposition de `isViewer: Signal<boolean>` et `canEdit: Signal<boolean>`.
   - Méthode centrale `ensureCanEdit(): boolean` interceptant les écritures pour le rôle `viewer`, émettant un toast informatif (`toast.info`) et renvoyant `false` sans déclencher d'appel réseau.
2. **Préservation de la consultation des chiffres en Planification** :
   - Le switch `Saisie / Visualisation` reste accessible au rôle `viewer` afin de consulter les valeurs numériques hebdomadaires de charge par ressource et projet.
   - Les actions d'édition en masse, de projection et de déplacement de charges sont neutralisées pour le rôle `viewer`.
3. **Application transversale aux Vues Planification, Capacité et Projets** :
   - Sécurisation uniforme des méthodes d'action et masquage/désactivation des boutons d'ajout et de suppression pour le rôle `viewer`.
4. **Message informatif non intrusif** :
   - Notification sous forme de toast de type `info` : *"Vous êtes en mode consultation (viewer) : les modifications ne sont pas autorisées."*
5. **Sélection multi-cellules et résumé chiffré en lecture seule** :
   - La sélection multi-cellules reste active pour les utilisateurs `viewer` dans les vues Planification et Capacité.
   - La barre d'outils flottante (`SelectionToolbarComponent`) supporte un mode `readOnly` qui affiche le résumé cumulé, les valeurs déjà saisies et les commentaires associés en mode verrouillé (`disabled`/`readonly`), tout en masquant ou bloquant les contrôles d'édition, de projection et de suppression.

## Conséquences

- **Positives** :
  - Élimination des requêtes HTTP inutiles et rejetées par la base de données.
  - Expérience utilisateur cohérente et explicite en mode consultation.
  - Logique d'autorisation d'écriture réutilisable et centralisée dans `PermissionService`.
- **Négatives / Compromis** :
  - Les contrôles d'écriture doivent intégrer systématiquement l'appel à `ensureCanEdit()` avant d'invoquer les services de données.
