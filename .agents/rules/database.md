# Données, Base de Données & Pagination (Supabase / PostgreSQL)

## Supabase / PostgREST Pagination Limit
- **Règle :** Attention au plafond silencieux de Supabase (PostgREST) qui limite par défaut les réponses des requêtes REST à un maximum de 1000 lignes.
- **Action :** Pour tous les `select` susceptibles de retourner plus de 1000 lignes, implémente obligatoirement une boucle de pagination utilisant `.range(from, to)` pour itérer par pages de 1000 jusqu'à ce que la totalité des données soit récupérée.

## Ordre Stable & Pagination Déterministe
- **Règle :** Chaque fois que des requêtes Supabase sont paginées (via offset, range, limit ou via la fonction utilitaire `paginateQuery`), il est obligatoire d'inclure une clause de tri `.order()` déterministe et unique AVANT le `.range()` (ex: trier par clé primaire `id` ou inclure l'index unique en fin de chaîne).
- **Raison :** Sans tri déterministe, PostgreSQL ne garantit aucun ordre par défaut. Les décalages de pagination (`offset` / `range`) peuvent renvoyer des lignes en double ou en omettre certaines entre deux requêtes successives.
- **Action :** Ajouter systématiquement un `.order('id', { ascending: true })` AVANT le `.range()` en fin de requête en guise de clé de tri stable (tie-breaker) pour toute requête paginée.
