# Gestion du Versioning (.gitignore)

## Hygiène Git & Protection de l''Environnement
- **Règle :** Ne jamais commiter de fichiers de logs (`*.log`), de dossiers de compilation (`dist/`, `.angular/`), de fichiers de configuration de secrets (`.env*`, `environment.ts`) ou de caches temporaires Supabase (`supabase/.temp/`).
- **Action :** Vérifier que le fichier `.gitignore` standard est bien présent et protège les environnements ainsi que les caches d''agents IA (`.claude/cache/`, `.bolt`, etc.).
