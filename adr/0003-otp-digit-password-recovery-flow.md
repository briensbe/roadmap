# ADR 0003: Flux de réinitialisation de mot de passe par code OTP à 6 chiffres

- **Statut** : Accepté
- **Date** : 2026-10-03
- **Auteurs** : Antigravity & Équipe Roadmap

## Contexte

La réinitialisation de mot de passe reposait précédemment sur un flux de lien magique avec redirection URL vers `update-password`. Ce mécanisme présentait des frictions : dépendance à la structure de hash / PKCE dans l'URL, instabilité sur certains contextes navigateurs ou onglets, et couplage ambigu entre la mise à jour connectée et la réinitialisation non connectée.

## Décisions

1. **Adoption de la validation par code OTP 6 chiffres** :
   - Utilisation de `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` pour valider le code émis par Supabase lors de `resetPasswordForEmail`.
   - Établissement direct de la session de récupération sans dépendre de liens de redirection complexes.
2. **Séparation étanche des composants et routes** :
   - `/reset-password` (`ResetPasswordComponent`) dédié au flux de récupération public multi-étapes.
   - `/update-password` (`UpdatePasswordComponent`) dédié à la modification par utilisateur connecté avec vérification du mot de passe actuel.
3. **Protection visuelle de l'e-mail** :
   - Masquage automatique via `maskEmail` dans `src/utils/email-validator.ts` avec option de modification.

## Conséquences

- **Positives** :
  - Parcours utilisateur fluide, déterministe et insensible aux problèmes de redirection/fragments d'URL.
  - Séparation des responsabilités claire entre l'espace public et l'espace authentifié.
  - Expérience utilisateur robuste et alignée avec CrewDayz.
- **Négatives / Limitations** :
  - Les codes OTP Supabase ont une durée de validité limitée (typiquement 10 minutes), nécessitant une option ergonomique de renvoi de code.
