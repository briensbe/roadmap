# ADR 0008: Sécurisation des Inscriptions par Trigger PostgreSQL Natif et Règles d'Accès Partagées

## Status
accepted, supersedes ADR-0002

## Supersedes
ADR-0002

## Date
2026-11-09

## Context
L'ADR 0002 avait introduit la restriction des inscriptions de nouveaux utilisateurs par domaine e-mail via des règles déclaratives côté frontend Angular (`environment.allowedEmailDomains`).
Le traitement de la recommandation de sécurité SEC-03 a mis en évidence les limites critiques de cette approche :
1. **Contournement par API directe :** Un appel direct à l'API Supabase (`curl /auth/v1/signup`) contourne le frontend.
2. **Fuite Google OAuth :** L'authentification par Google OAuth insère l'utilisateur dans `auth.users` sans filtre de domaine.
3. **Rigidité :** L'ajout d'un domaine ou d'un compte partenaire exige une recompilation et un redéploiement de Roadmap.

L'application **Roadmap** partage avec **CrewDayz** la même instance Supabase Cloud de production (`https://jfafunxtgkjyezrqouyc.supabase.co`) et le même annuaire `auth.users`.
La sécurisation serveur (schéma `app_auth`, table `allowed_rules`, vue sécurisée `public.allowed_rules` et Trigger PostgreSQL `BEFORE INSERT ON auth.users`) a été mise en place avec succès. Roadmap doit désormais s'aligner sur cette architecture.

## Decision

Nous adoptons le modèle partagé "Passeport vs Visa" (identique à l'ADR 0011 de Crewdayz) :
1. **Vue sécurisée `public.allowed_rules` :** Roadmap interroge la vue publique PostgREST exposant exclusivement les domaines autorisés actifs (`rule_type = 'domain'`). Les adresses e-mails VIP individuelles ne sont jamais exposées publiquement.
2. **Service Angular dynamique (`AuthConfigService`) :** Centralisation du chargement des règles dans `src/services/auth-config.service.ts` avec repli sur `environment.allowedEmailDomains`.
3. **Support complet des VIPs (Mot de passe et OAuth) :**
   - Via Google OAuth : le Trigger PostgreSQL (`SECURITY DEFINER`) autorise directement l'e-mail VIP sans restriction de domaine.
   - Via formulaire d'inscription standard : le frontend valide les domaines connus et, pour les adresses hors domaines d'entreprise, délègue la décision au Trigger PostgreSQL sans bloquer prématurément le formulaire.
4. **Message standardisé :** Harmonisation du message d'erreur d'accès refusé : *"Veuillez utiliser votre adresse professionnelle autorisée."*.

## Consequences

- **Positives :**
  - Vulnérabilité SEC-03 résolue sur Roadmap de manière hermétique.
  - Aucune nouvelle migration de base de données n'est nécessaire (infrastructure transverse déjà active).
  - Les utilisateurs VIP (prestataires, comptes d'exception) peuvent s'inscrire à la fois par mot de passe et par Google OAuth.
  - La liste des adresses personnelles VIP reste 100% confidentielle (inaccessible via l'API publique).
  - Maintien du Single Sign-On (SSO) transparent entre Roadmap et Crewdayz.
- **Négatives / Précautions :**
  - Une tentative d'inscription avec une adresse non autorisée déclenche une requête vers Supabase avant de recevoir l'erreur standardisée.
