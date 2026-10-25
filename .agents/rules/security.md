# Sécurité & Gestion des Secrets

## Clés API / Identifiants
- **Règle :** Ne JAMAIS écrire, coder en dur ou insérer de variables d'environnement de type clé d'API, token ou secret directement dans les fichiers de code source ou les scripts (scripts de test, migrations, utilitaires).
- **Action :** Importer et utiliser systématiquement la configuration dynamique issue des fichiers d'environnement dédiés (ex: `src/environments/environment.ts`, `environment.prod.ts` ou fichiers `.env`).
