#!/bin/bash

# --- VÉRIFICATION DES ARGUMENTS ---
if [ "$#" -ne 1 ]; then
    echo "Usage: backup_supabase.sh <project_ref> "
    exit 1
fi

PROJECT_REF=$1
#DB_PASSWORD=$2

# --- CONFIGURATION DYNAMIQUE ---
# On récupère le dossier où tu te trouves actuellement
CURRENT_DIR=$(pwd)
DATE_DIR=$(date +%Y-%m-%d)
TIME_SUFFIX=$(date +%H%M)
BACKUP_PATH="$CURRENT_DIR/$DATE_DIR"

echo "--- 🛠️ Backup Supabase dans le répertoire courant ---"
echo "📍 Localisation : $CURRENT_DIR"

# 1. Vérification Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Erreur : Docker n'est pas lancé."
    exit 1
fi

# 2. Création du dossier du jour (ex: ./2026-03-21/)
mkdir -p "$BACKUP_PATH"

# 3. Export du mot de passe pour la session
#export SUPABASE_DB_PASSWORD="$DB_PASSWORD"

# 4. Lien au projet (on reste dans le répertoire courant pour le link)
echo "🔗 Connexion au projet $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"
# --password "$DB_PASSWORD"

# 5. Sauvegardes dans le sous-dossier daté
SCHEMA_FILE="$BACKUP_PATH/schema_public_${TIME_SUFFIX}.sql"
DATA_FILE="$BACKUP_PATH/data_${TIME_SUFFIX}.sql"

echo "📄 Extraction du schéma public..."
supabase db dump --linked --schema public -f "$SCHEMA_FILE"

echo "💾 Extraction des données..."
supabase db dump --linked --data-only -f "$DATA_FILE"

# 6. Résultat
echo -e "\n--- ✨ Sauvegarde terminée ---"
echo "Fichiers générés dans $DATE_DIR/ :"
ls -lh "$SCHEMA_FILE" "$DATA_FILE"

# Nettoyage
#unset SUPABASE_DB_PASSWORD

echo "Unlinking project -> supabase unlink"
supabase unlink
echo "Listing project -> supabase projects list"
supabase projects list


