# Guide utilisateur — Roadmap

> Outil de planification de capacité et de projets pour équipes de développement.

---

## 🚀 Démarrage rapide

Roadmap suit globalement une logique en **6 étapes**, dans cet ordre :

```
1. Organisation  →  2. Ressources  →  3. Capacité  →  4. Projets  →  5. Planification  →  6. Jalons
```

---

## 📖 Glossaire

| Terme                | Définition                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Ressource**        | Une unité de travail rattachée à une équipe. Peut être un **Rôle** (ex. "Développeur") ou une **Personne** nominative. |
| **Capacité**         | Nombre de ressources disponibles par équipe et par semaine.                                                            |
| **Nb Jours/Semaine** | Jours effectifs consacrés à un projet par une ressource (hors maintenance, réunions, etc.).                            |
| **RAF**              | Reste À Faire — calculé automatiquement à partir des chiffres Prévisionnel/Consommé et de la semaine en cours.         |
| **Jalon**            | Évènement clé du projet : Sprint, Livraison ou MEP (Mise en Production).                                               |

---

## 1. Organisation — Structurer la société

Onglet **Organisation**.

Créez la hiérarchie de votre société selon ce modèle :

```
Société
└── Département
    └── Service
        └── Équipe
```

Les équipes créées ici seront les conteneurs auxquels vous rattacherez ensuite vos ressources.

---

## 2. Ressources — Définir qui peut travailler

Onglet **Ressources**.

Chaque ressource est rattachée à **une équipe** définie à l'étape 1. Deux types :

- **Rôle** générique (ex. "Développeur", "QA") — utile pour planifier sans nommer une personne.
- **Personne** nominative — pour un suivi précis.

Renseignez le **Nb de Jours/Semaine** pour chaque ressource : le nombre de jours **effectivement consacrés à un projet**, pas le temps de présence.

> 💡 **Astuce — Soyez réalistes sur la capacité réelle**
>
> Avec les tâches de maintenance, réunions, support, code review, un développeur n'est généralement **compté qu'à 3,5 à 4 j/semaine**, pas 5.
>
> Cette précision est ce qui vous permettra d'annoncer une fin de développement avec une **marge raisonnable** plutôt qu'une promesse intenable.

---

## 3. Capacité — Projeter les disponibilités

Onglet **Capacité**.

Pour chaque équipe :

1. Ajoutez les ressources qui la composent (définies à l'étape 2).
2. Projetez le **nombre de ressources disponibles pour chaque semaine** sur la période à planifier.

Cette projection est ce qui alimentera la vue Planification : sans capacité définie, pas de planification possible.

---

## 4. Projets — Référencer ce qu'il y a à faire

Onglet **Projets**.

Créez vos projets. Ils deviennent **immédiatement disponibles dans la vue Planification**.

### Champs disponibles

| Champ                 | Usage                        |
| --------------------- | ---------------------------- |
| **Code Projet**       | Référence interne (Triskell) |
| **Référence Externe** | Lien JIRA                    |
| **Initial**           | Estimation de départ (jours) |
| **Révisé**            | Estimation après affinage    |
| **Prévisionnel**      | Estimation courante          |
| **Consommé**          | Jours déjà consommés         |

### Exemple de calcul RAF

> Projet "Refonte Auth" — Prévisionnel : **60 j**, Consommé : **22 j**
> → **RAF = 38 j** calculé par rapport à la semaine en cours.

Le RAF est mis à jour automatiquement et sert de base au suivi d'avancement.

---

## 5. Planification — Projeter les jours

Onglet **Planification**.

C'est ici que tout converge :

1. **Associez un projet à une équipe.**
2. **Associez les ressources de l'équipe au projet.**
3. **Projetez les jours au niveau Ressource** — la projection se fait **uniquement à ce niveau**, pas au niveau Équipe ni Projet.

### Choisir sa vue

Plusieurs vues sont disponibles selon ce que vous cherchez à voir :

- **Par Ressources** — voir la charge de chaque personne semaine par semaine. _(Vue recommandée pour le pilotage quotidien.)_
- **Par Projets** — voir l'avancement et la projection de chaque projet.
- **Par Équipes** — voir la charge agrégée par équipe.

Testez les trois, gardez celle qui vous parle le plus.

---

## 6. Jalons — Marquer les évènements clés

Trois types de jalons disponibles :

| Type          | Quand l'utiliser            |
| ------------- | --------------------------- |
| **Sprint**    | Fin de sprint, démo         |
| **Livraison** | Livraison interne ou client |
| **MEP**       | Mise en Production          |

Les jalons sont **visibles dans la vue Planification**, ce qui permet de les confronter visuellement à la charge prévue.

---

## ℹ️ Bon à savoir

### Historique des versions

L'historique est disponible **au niveau du n° de version** (en bas de l'écran).

---

_Pour toute question ou remontée de bug, [contacter l'équipe Roadmap]._
