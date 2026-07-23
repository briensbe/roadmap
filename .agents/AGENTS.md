# Règles de codage et de sécurité du projet

## Sécurité & Clés API / Identifiants
- **Règle :** Ne JAMAIS écrire, coder en dur ou insérer de variables d'environnement de type clé d'API, token ou secret directement dans les fichiers de code source ou les scripts (scripts de test, migrations, utilitaires).
- **Action :** Importer et utiliser systématiquement la configuration dynamique issue des fichiers d'environnement dédiés (ex: `src/environments/environment.ts`, `environment.prod.ts` ou fichiers `.env`).

## Angular & Typescript
- Utiliser exclusivement la nouvelle syntaxe de contrôle de flux native d'Angular (blocs `@if` et `@for`) à la place des anciennes directives structurelles (`*ngIf`, `*ngFor`).
- Préférer l'utilisation de typages stricts.
- Toujours utiliser la structure séparée html, CSS et ts.

## Supabase / PostgreSQL Pagination & Stable Order
- **Règle :** Chaque fois que des requêtes Supabase sont paginées (via offset, range, limit ou via la fonction utilitaire `paginateQuery`), il est obligatoire d'inclure une clause de tri `.order()` déterministe et unique AVANT le `.range()` (ex: trier par clé primaire `id` ou inclure l'index unique en fin de chaîne).
- **Raison :** Sans tri déterministe, PostgreSQL ne garantit aucun ordre par défaut. Les décalages de pagination (`offset` / `range`) peuvent renvoyer des lignes en double ou en omettre certaines entre deux requêtes successives.
- **Action :** Ajouter systématiquement un `.order('id', { ascending: true })` AVANT le `.range()` en fin de requête en guise de clé de tri stable (tie-breaker) pour toute requête paginée.
