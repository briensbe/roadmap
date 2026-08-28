# 1. Modèle de Résolution Hybride des Capacités et Gestion des Surcharges

Date: 2026-08-28

## Status

accepted

## Context

L'application Roadmap Vision intègre les disponibilités d'équipes et de profils depuis le système externe Crewdayz via RPCs Supabase et fonctions de mapping. Cependant, les responsables de planification ont besoin de corriger ponctuellement ou d'ajuster les capacités calculées par Crewdayz (par ajout/retrait de deltas ou forçage manuel de valeurs absolues) sans altérer les données sources externes de Crewdayz ni corrompre les capacités Roadmap historiques en cas de bascule de source.

## Decision

Nous adoptons une architecture de résolution hybride de capacité avec stockage dédié des ajustements :
1. La table `roadmap_capacites` est étendue avec des champs optionnels : `override_capacite` (forçage absolu), `override_delta` (delta relatif $\pm\Delta$) et `comment` (note explicative).
2. Le champ `capacite` d'origine reste réservé à la saisie manuelle en mode de source `roadmap`.
3. Une fonction de résolution unifiée détermine la capacité effective selon la source active de l'équipe :
   - Mode `roadmap` : utilise `capacite`.
   - Mode `crewdayz` :
     - Si `override_capacite` est non nul $\rightarrow$ `override_capacite`.
     - Sinon si `override_delta` est non nul $\rightarrow \max(0, \text{Crewdayz} + \text{override\_delta})$.
     - Sinon $\rightarrow \text{Crewdayz}$ (0 si ressource non mappée, aucun fallback sur `capacite` Roadmap).
4. Cette règle de calcul est appliquée de manière identique dans la vue Capacité et dans l'index de planification de la vue Planification.

## Consequences

- **Positives :**
  - Isolation stricte des données de saisie manuelle Roadmap et des ajustements Crewdayz.
  - Réversibilité totale lors du changement de source d'une équipe.
  - Clarté pour l'utilisateur qui peut choisir entre valeur forcée, delta relatif et valeur brute.
- **Négatives / Contraintes :**
  - Nécessite d'assurer que toutes les vues et exports consomment la fonction de résolution unifiée plutôt que de lire directement le champ `capacite`.
