#!/bin/bash

# --- CONFIGURATION ET VALEURS PAR DÉFAUT ---
PROJECT_NAME=""
CURRENT_DIR=$(pwd)
DATE_STR=$(date +%Y-%m-%d)
TIME_SUFFIX=$(date +%H%M)

# --- USAGE ---
usage() {
    echo "Usage: $0 -r <project_ref> -w <DB_password> [-p <project_name>]"
    echo "  -r : Project Reference Supabase (obligatoire)"
    echo "  -w : Mot de passe de la base de données (obligatoire)"
    echo "  -p : Nom du projet pour suffixer le dossier (optionnel)"
    exit 1
}

# --- ANALYSE DES ARGUMENTS ---
# r: et w: attendent une valeur, p: aussi.
while getopts "r:w:p:" opt; do
    case $opt in
        r) PROJECT_REF="$OPTARG" ;;
        w) DB_PASSWORD="$OPTARG" ;;
        p) PROJECT_NAME="_$OPTARG" ;; # On ajoute le underscore ici pour le suffixe
        *) usage ;;
    esac
done

# Vérification des champs obligatoires
if [ -z "$PROJECT_REF" ] || [ -z "$DB_PASSWORD" ]; then
    usage
fi

# --- CONFIGURATION DYNAMIQUE ---
# Le dossier inclut maintenant le nom du projet s'il est fourni
BACKUP_PATH="$CURRENT_DIR/${DATE_STR}${PROJECT_NAME}"

echo "--- 🛠️ Backup Supabase ---"
echo "📍 Dossier cible : $BACKUP_PATH"

# 1. Vérification Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Erreur : Docker n'est pas lancé."
    exit 1
fi

# 2. Création du dossier (ex: ./2026-03-21_monprojet/)
mkdir -p "$BACKUP_PATH"

# 3. Export du mot de passe
export SUPABASE_DB_PASSWORD="$DB_PASSWORD"

# 4. Lien au projet
echo "🔗 Connexion au projet $PROJECT_REF..."
# Utilisation de --no-input pour éviter les blocages en script
supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"

# 5. Sauvegardes
# On utilise une variable pour le préfixe du fichier pour plus de clarté
FILE_PREFIX="${TIME_SUFFIX}_${PROJECT_REF:0:8}"
SCHEMA_FILE="$BACKUP_PATH/schema_public_${FILE_PREFIX}.sql"
DATA_FILE="$BACKUP_PATH/data_${FILE_PREFIX}.sql"

echo "📄 Extraction du schéma public..."
if supabase db dump --linked --schema public -f "$SCHEMA_FILE"; then
    echo "✅ Schéma extrait."
else
    echo "❌ Erreur lors de l'extraction du schéma."
fi

echo "💾 Extraction des données..."
supabase db dump --linked --data-only -f "$DATA_FILE"

# 6. Résultat
echo -e "\n--- ✨ Sauvegarde terminée ---"
ls -lh "$SCHEMA_FILE" "$DATA_FILE"

# Nettoyage
unset SUPABASE_DB_PASSWORD
echo "Unlinking project -> supabase unlink"
supabase unlink
echo "Listing project -> supabase projects list"
supabase projects list
