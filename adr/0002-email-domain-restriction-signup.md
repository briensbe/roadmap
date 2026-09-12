# ADR 0002: Restriction des domaines d'e-mails à l'inscription

- **Statut** : Accepté
- **Date** : 2026-09-12
- **Auteurs** : Antigravity

## Contexte

Dans Roadmap, le formulaire d'inscription permettait par défaut la création de compte avec n'importe quelle adresse e-mail valide. Pour réserver l'accès aux membres de l'organisation et éviter les inscriptions avec des adresses personnelles ou non autorisées, un mécanisme de filtrage par domaine d'e-mail est nécessaire.

## Décisions

1. **Configuration déclarative par environnement** : Définition d'un tableau `allowedEmailDomains: string[]` dans `src/environments/environment.ts` et `src/environments/environment.prod.ts`. Si le tableau est vide ou non défini, aucune restriction n'est appliquée (mode permissif par défaut pour le développement).
2. **Module utilitaire dédié** : Implémentation des fonctions de validation et de normalisation dans `src/utils/email-validator.ts` avec couverture par tests unitaires (`src/utils/email-validator.spec.ts`).
3. **Double validation défensive** :
   - Côté UI dans `SignupComponent` avec affichage d'un message d'erreur clair et mise à jour dynamique du placeholder.
   - Côté service dans `SupabaseService.signUpWithEmail` pour bloquer toute tentative non conforme avant l'appel à Supabase Auth.

## Conséquences

- **Positives** :
  - Contrôle strict et hermétique des domaines d'adresses autorisés.
  - Expérience utilisateur guidée (messages d'erreurs explicites, placeholder adapté).
  - Aucune dépendance de base de données ni latence réseau supplémentaire.
  - Rétrocompatibilité préservée en mode ouvert si la liste est vide.
- **Négatives / Limitations** :
  - La modification des domaines autorisés nécessite une recompilation / un redéploiement front-end.
