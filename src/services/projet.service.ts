import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Projet } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class ProjetService {
  constructor(private supabase: SupabaseService) {}

  async getAllProjets(): Promise<Projet[]> {
    const { data, error } = await this.supabase.client
      .from('projets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getProjet(id: string): Promise<Projet | null> {
    const { data, error } = await this.supabase.client
      .from('projets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createProjet(projet: Partial<Projet>): Promise<Projet> {
    const { data, error } = await this.supabase.client
      .from('projets')
      .insert([projet])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProjet(id: string, projet: Partial<Projet>): Promise<Projet> {
    const { data, error } = await this.supabase.client
      .from('projets')
      .update({ ...projet, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProjet(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('projets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  calculateRAF(projet: Projet): number {
    return projet.chiffrage_previsionnel - projet.temps_consomme;
  }
}
