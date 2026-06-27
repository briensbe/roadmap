-- Migration: Rename roadmap_budget_import to roadmap_import_budget
ALTER TABLE IF EXISTS roadmap_budget_import RENAME TO roadmap_import_budget;
