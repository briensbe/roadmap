# ✅ Checklist - Avant d'utiliser la modale Chiffres

## 📋 Configuration requise

### ✓ Base de données Supabase
- [ ] Migration SQL `add_table_chiffres_20251219.sql` exécutée
- [ ] Table `chiffres` créée avec les colonnes:
  - [ ] `id_chiffres` (INTEGER PRIMARY KEY)
  - [ ] `id_projet` (INTEGER, FOREIGN KEY)
  - [ ] `id_service` (INTEGER, FOREIGN KEY)
  - [ ] `initial` (DECIMAL)
  - [ ] `revise` (DECIMAL)
  - [ ] `previsionnel` (DECIMAL)
  - [ ] `consomme` (DECIMAL)
  - [ ] `date_mise_a_jour` (TIMESTAMP)
  - [ ] `created_at` (TIMESTAMP)
  - [ ] `updated_at` (TIMESTAMP)
- [ ] Index créés:
  - [ ] `idx_chiffres_projet` sur `id_projet`
  - [ ] `idx_chiffres_service` sur `id_service`
- [ ] RLS activé sur la table `chiffres`
- [ ] Policy créée pour les utilisateurs authentifiés
- [ ] Colonnes `id_projet` et `id_service` ajoutées aux tables `projets` et `services`
- [ ] Valeurs `id_projet` et `id_service` populées pour tous les enregistrements existants

### ✓ Application Angular
- [ ] Angular 17+ ou compatible avec les standalone components
- [ ] CommonModule disponible
- [ ] FormsModule disponible
- [ ] SupabaseService configuré et fonctionnel
- [ ] ResourceService disponible pour charger les services

### ✓ Fichiers du code source
- [ ] `src/models/chiffres.type.ts` créé
- [ ] `src/services/chiffres.service.ts` créé
- [ ] `src/components/chiffres-modal.component.ts` créé
- [ ] `src/components/chiffres-modal.component.html` créé
- [ ] `src/components/chiffres-modal.component.css` créé

## 🔐 Permissions et sécurité

### ✓ RLS Supabase (Row Level Security)
```sql
-- Vérifiez que cette policy existe:
CREATE POLICY "Allow all operations for authenticated users on chiffres"
  ON chiffres FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- [ ] Policy pour les utilisateurs authentifiés
- [ ] Policy de lecture pour les utilisateurs non authentifiés (optionnel)
- [ ] Vérifier que l'utilisateur actuel est authentifié

### ✓ Permissions des tables
- [ ] Table `chiffres` : SELECT, INSERT, UPDATE, DELETE autorisés
- [ ] Table `services` : SELECT autorisé
- [ ] Table `projets` : SELECT autorisé
- [ ] Table `charges` : SELECT autorisé (pour le calcul du RAF)

## 🧪 Tests de fonctionnalité

### ✓ CRUD de base
- [ ] Créer un nouveau chiffre
  ```typescript
  const chiffre = await chiffresService.createChiffre({
    id_projet: 1,
    id_service: 1,
    initial: 100,
    revise: 110,
    previsionnel: 120,
    consomme: 50,
    date_mise_a_jour: new Date().toISOString()
  });
  ```
- [ ] Lire les chiffres d'un projet
  ```typescript
  const chiffres = await chiffresService.getChiffresByProject(1);
  ```
- [ ] Mettre à jour un chiffre
  ```typescript
  await chiffresService.updateChiffre(1, {
    initial: 105,
    previsionnel: 125
  });
  ```
- [ ] Supprimer un chiffre
  ```typescript
  await chiffresService.deleteChiffre(1);
  ```

### ✓ Calculs automatiques
- [ ] Delta calculé correctement (Prévisionnel - Révisé)
- [ ] Restant calculé correctement (Prévisionnel - Consommé)
- [ ] Totaux affichés correctement en bas du tableau

### ✓ RAF (Ressources Affectées)
- [ ] RAF calculé pour la date sélectionnée
- [ ] RAF met à jour quand la date change
- [ ] RAF agrège correctement les charges de la table

### ✓ Copier-coller Excel
- [ ] Copier 4 cellules depuis Excel
  ```
  100	110	120	50
  200	210	220	100
  ```
- [ ] Coller dans le champ Initial du premier service
- [ ] Vérifier que les valeurs sont distribuées correctement
  - Service 1: I=100, R=110, P=120, C=50
  - Service 2: I=200, R=210, P=220, C=100
- [ ] Tester avec des valeurs à décimales
- [ ] Tester avec des décimales en virgule (,)

### ✓ Interface utilisateur
- [ ] Modale s'affiche quand `visible=true`
- [ ] Modale se ferme quand `close` est émis
- [ ] Champs modifiables sont éditables
- [ ] Champs calculés sont en lecture seule (grisés)
- [ ] Totaux en bas du tableau
- [ ] Date de RAF sélectionnable
- [ ] Boutons Annuler et Enregistrer fonctionnels
- [ ] Messages d'erreur affichés clairement
- [ ] Loading state affiché pendant la sauvegarde

### ✓ Gestion des erreurs
- [ ] Erreur de connexion Supabase gérée
- [ ] Erreur de permission affichée à l'utilisateur
- [ ] Erreur de validation capturée
- [ ] Message d'erreur clair et utile

## 🔄 Intégration avec le composant parent

### ✓ Import et déclaration
- [ ] Import du composant `ChiffresModalComponent`
- [ ] Ajout à la liste `imports` du composant parent
- [ ] Propriétés déclarées:
  ```typescript
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;
  ```

### ✓ Template
- [ ] Bouton pour ouvrir la modale
- [ ] Composant `<app-chiffres-modal>` ajouté
- [ ] Propriété `[visible]` bindée
- [ ] Propriété `[idProjet]` bindée
- [ ] Événement `(close)` bindé
- [ ] Événement `(saved)` bindé

### ✓ Logique
- [ ] Méthode `openChiffresModal()` implémentée
- [ ] Méthode `closeChiffresModal()` implémentée
- [ ] Méthode `onChiffresModalSaved()` implémentée
- [ ] Gestion correcte de l'`id_projet` (numérique, pas UUID)

## 🚀 Avant le déploiement en production

### ✓ Performance
- [ ] Tests de charge sur 100+ services/projets
- [ ] Cache fonctionne correctement
- [ ] Pas de requêtes N+1
- [ ] Time-to-interactive acceptable (<3s)

### ✓ Compatibilité navigateur
- [ ] Chrome dernière version
- [ ] Firefox dernière version
- [ ] Safari dernière version
- [ ] Edge dernière version
- [ ] Mobile (iOS/Android si applicable)

### ✓ Accessibilité
- [ ] Navigation au clavier possible
- [ ] Labels pour tous les champs
- [ ] Contraste des couleurs acceptable
- [ ] Texte d'erreur clair et visible

### ✓ Documentation
- [ ] README.md créé
- [ ] Guide d'intégration créé
- [ ] Snippets prêts à copier-coller
- [ ] Exemples complets fournis
- [ ] Commentaires dans le code

### ✓ Sauvegarde et déploiement
- [ ] Code versionné dans Git
- [ ] Migrations SQL documentées
- [ ] Variables d'environnement configurées
- [ ] Secrets Supabase sécurisés
- [ ] Backup de la base de données planifié

## 📊 Données de test

### ✓ Préparation des données de test
```sql
-- Ajouter des données de test
INSERT INTO projets (id_projet, nom_projet, code_projet) VALUES
(1, 'Projet Test 1', 'PT001'),
(2, 'Projet Test 2', 'PT002');

INSERT INTO services (id_service, nom) VALUES
(1, 'Service Dev'),
(2, 'Service QA'),
(3, 'Service DevOps');

INSERT INTO chiffres (id_projet, id_service, initial, revise, previsionnel, consomme) VALUES
(1, 1, 100, 110, 120, 50),
(1, 2, 200, 190, 210, 80),
(2, 1, 150, 140, 160, 70);
```

- [ ] Au moins 1 projet avec plusieurs services
- [ ] Services avec et sans chiffres existants
- [ ] Chiffres avec différentes valeurs (y compris des écarts)
- [ ] Charges associées pour tester le RAF

## 🐛 Débogage

### ✓ Logging
- [ ] Console.log activé dans le développement
- [ ] Messages clairs pour chaque opération
- [ ] Erreurs détaillées affichées

### ✓ Outils de développement
- [ ] Inspecteur réseau (Network tab)
  - [ ] Requêtes Supabase correctes
  - [ ] Pas de requêtes dupliquées
  - [ ] Time-to-response acceptable
- [ ] Console JavaScript
  - [ ] Pas d'erreurs
  - [ ] Messages de succès visibles
- [ ] React/Angular DevTools
  - [ ] Composant visible dans l'arborescence
  - [ ] Props/Inputs corrects
  - [ ] Pas de memory leaks

## 📱 Tests spécifiques par fonctionnalité

### Excel Copy-Paste
- [ ] Test avec Excel
- [ ] Test avec Google Sheets
- [ ] Test avec LibreOffice Calc
- [ ] Test avec des décimales (. et ,)
- [ ] Test avec des espaces supplémentaires
- [ ] Test avec des valeurs manquantes

### Calculs
- [ ] Delta: Prévi(120) - Révisé(110) = Delta(10) ✓
- [ ] Restant: Prévi(120) - Consommé(50) = Restant(70) ✓
- [ ] RAF: Somme des charges > date = RAF(x) ✓
- [ ] Totaux: Somme correcte de toutes les lignes ✓

### Dates
- [ ] Date de mise à jour: Aujourd'hui par défaut ✓
- [ ] Date RAF: Sélectionnable et changeable ✓
- [ ] Historique: Timestamps créé/mis à jour ✓

## ✔️ Validation finale

- [ ] Tous les tests passent
- [ ] Aucune erreur en console
- [ ] Performance acceptable
- [ ] Documentation complète
- [ ] Code commenté et propre
- [ ] Git commits descriptifs
- [ ] Prêt pour la production ✅

---

## 🆘 En cas de problème

Si un test échoue, consultez:

1. **CHIFFRES_MODAL_README.md** - Vue d'ensemble complète
2. **CHIFFRES_INTEGRATION_GUIDE.md** - Options d'intégration
3. **CHIFFRES_MAPPING_IDS.md** - Problèmes d'IDs
4. **CHIFFRES_SNIPPETS.md** - Code d'exemple
5. **logs de Supabase** - Erreurs de base de données

## 📝 Signature

- **Créé par:** Assistant de développement
- **Date:** 20 décembre 2024
- **Version de Angular:** 17+
- **Statut:** ✅ Prêt pour vérification
