import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Jalon } from '../models/types';
import { DB_TABLES } from '../constants/db-tables';
import { paginateQuery } from '../utils/supabase-pagination';

@Injectable({
  providedIn: 'root',
})
export class JalonService {
  private _jalonsCache: Jalon[] | null = null;

  constructor(
    private supabase: SupabaseService
  ) {}

  private clearCache() {
    this._jalonsCache = null;
  }

  async getAllJalons(): Promise<Jalon[]> {
    if (this._jalonsCache) {
      return this._jalonsCache;
    }

    const data = await paginateQuery<Jalon>(
      () => this.supabase.client.from(DB_TABLES.JALONS).select('*').order('event_date', { ascending: true }).order('id', { ascending: true })
    );

    this._jalonsCache = data || [];
    return this._jalonsCache;
  }

  async getJalonsByProject(projetId: string): Promise<Jalon[]> {
    const data = await paginateQuery<Jalon>(
      () => this.supabase.client
        .from(DB_TABLES.JALONS)
        .select('*')
        .eq('projet_id', projetId)
        .order('event_date', { ascending: true })
        .order('id', { ascending: true })
    );

    return data || [];
  }

  async createJalon(jalon: Partial<Jalon>): Promise<Jalon> {
    const { data, error } = await this.supabase.client.from(DB_TABLES.JALONS).insert([jalon]).select().single();

    if (error) throw error;
    this.clearCache();
    return data;
  }

  async updateJalon(id: string, jalon: Partial<Jalon>): Promise<Jalon> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.JALONS)
      .update(jalon)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteJalon(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.JALONS).delete().eq('id', id);

    if (error) throw error;
    this.clearCache();
  }
}
