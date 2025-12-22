import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Projet } from "../models/types";

@Injectable({
  providedIn: "root"
})
export class ProjetService {
  // Simple in-memory caches
  private _projetsCache: Projet[] | null = null;
  private _equipeProjetLinksCache: { equipe_id: string; projet_id: string }[] | null = null;

  constructor(private supabase: SupabaseService) { }

  private clearCache() {
    this._projetsCache = null;
    this._equipeProjetLinksCache = null;
  }

  async getAllProjets(): Promise<Projet[]> {
    if (this._projetsCache) {
      return this._projetsCache;
    }

    const { data, error } = await this.supabase.client
      .from("projets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    this._projetsCache = data || [];
    return this._projetsCache;
  }

  async getProjet(id: string): Promise<Projet | null> {
    // Try to resolve from cache first
    if (this._projetsCache) {
      const found = this._projetsCache.find(p => p.id === id) || null;
      if (found) return found;
    }

    const { data, error } = await this.supabase.client
      .from("projets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createProjet(projet: Partial<Projet>): Promise<Projet> {
    const { data, error } = await this.supabase.client
      .from("projets")
      .insert([projet])
      .select()
      .single();

    if (error) throw error;
    // Invalidate cache
    this.clearCache();
    return data;
  }

  async updateProjet(id: string, projet: Partial<Projet>): Promise<Projet> {
    const { data, error } = await this.supabase.client
      .from("projets")
      .update({ ...projet, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    // Invalidate cache
    this.clearCache();
    return data;
  }

  async deleteProjet(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("projets")
      .delete()
      .eq("id", id);

    if (error) throw error;
    // Invalidate cache
    this.clearCache();
  }

  calculateRAF(projet: Projet): number {
    return projet.chiffrage_previsionnel - projet.temps_consomme;
  }

  async getAllEquipeProjetLinks(): Promise<{ equipe_id: string; projet_id: string }[]> {
    if (this._equipeProjetLinksCache) {
      return this._equipeProjetLinksCache;
    }

    const { data, error } = await this.supabase.client
      .from("equipes_projets")
      .select("*");

    if (error) throw error;
    this._equipeProjetLinksCache = data || [];
    return this._equipeProjetLinksCache;
  }

  async linkProjectToTeam(projetId: string, equipeId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("equipes_projets")
      .insert({ projet_id: projetId, equipe_id: equipeId });

    if (error) throw error;
    this.clearCache();
  }

  async unlinkProjectFromTeam(projetId: string, equipeId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("equipes_projets")
      .delete()
      .eq("projet_id", projetId)
      .eq("equipe_id", equipeId);

    if (error) throw error;
    this.clearCache();
  }
}
