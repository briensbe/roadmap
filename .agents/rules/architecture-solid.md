# Architecture & Qualité de Conception (SOLID & Deep Modules)

## Philosophie de conception (Deep Modules)
- **Privilégier les modules profonds :** Chaque composant ou service doit masquer un maximum de complexité derrière une interface la plus simple et étroite possible.
- **Interdiction des modules "pass-through" :** Ne pas créer de fichiers ou de fonctions dont le seul but est de relayer des données sans valeur ajoutée.
- **Encapsulation forte :** Les détails d'implémentation (appels réseaux complexes, transformations de données tordues) doivent être enfouis dans les couches basses et ne jamais fuiter dans l'UI ou le code appelant.

## Règle d'or : Composition vs Héritage
- Privilégier systématiquement la **composition** et l'injection de dépendances pour réutiliser du comportement (ex: services injectés, stratégies, helpers).
- Préférer l'implémentation d'interfaces (`implements`) à l'héritage de comportement, pour maintenir un couplage lâche.

## 1. Limite de taille des fichiers
- **Taille maximale par fichier `.ts` : 1000 lignes (+ ou - 20%).**
- Si un fichier approche ou dépasse cette limite, l'agent **doit** le refactoriser en extrayant la logique dans de nouveaux modules (composants, services, helpers, stores).

## 2. Application des principes SOLID
- **SRP (Responsabilité Unique) :** Un fichier / une classe / un composant ne doit avoir qu'une seule raison d'être. Séparer strictement la couche UI, la gestion d'état (store/service) et la logique métier pure.
- **OCP (Open Close Principle) / DIP (Dependency Inversion Principle) :** Utiliser systématiquement des interfaces et l'injection de dépendances pour les services. Ne pas lier directement un composant à une implémentation concrète d'API ou de stockage.
- **ISP (Interface Segregation Principle) :** Diviser les grosses interfaces d'objets en sous-interfaces ciblées selon l'utilisation réelle.

## 3. Workflow de refactoring obligatoire
Lorsqu'une modification risque d'alourdir un fichier existant :
1. Proposer un plan de découpage avant d'écrire le code.
2. Créer les nouveaux fichiers modulaires.
3. Déplacer le code existant de manière propre sans régresser.
