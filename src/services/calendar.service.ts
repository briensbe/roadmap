import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Capacite, Charge, Jalon, WeekData } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  constructor(private supabase: SupabaseService) { }

  getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  //TODO: move to utils et surtout à réutiliser dans les autres services et components
  isCurrentWeek(date: Date): boolean {
    const now = new Date();
    const currentWeekStart = this.getWeekStart(now);
    return this.formatWeekStart(date) === this.formatWeekStart(currentWeekStart);
  }

  formatWeekStart(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async getCapacites(filters?: {
    roleId?: string;
    personneId?: string;
    equipeId?: string;
    serviceId?: string;
    departementId?: string;
    societeId?: string;
  }): Promise<Capacite[]> {
    let query = this.supabase.client
      .from('capacites')
      .select('*');

    if (filters?.roleId) query = query.eq('role_id', filters.roleId);
    if (filters?.personneId) query = query.eq('personne_id', filters.personneId);
    if (filters?.equipeId) query = query.eq('equipe_id', filters.equipeId);
    if (filters?.serviceId) query = query.eq('service_id', filters.serviceId);
    if (filters?.departementId) query = query.eq('departement_id', filters.departementId);
    if (filters?.societeId) query = query.eq('societe_id', filters.societeId);

    const { data, error } = await query.order('semaine_debut');
    if (error) throw error;
    return data || [];
  }

  async setCapacite(capacite: Partial<Capacite>): Promise<Capacite> {
    const existing = await this.findExistingCapacite(capacite);

    if (existing) {
      const { data, error } = await this.supabase.client
        .from('capacites')
        .update({ capacite: capacite.capacite })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase.client
        .from('capacites')
        .insert([capacite])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  private async findExistingCapacite(capacite: Partial<Capacite>): Promise<Capacite | null> {
    let query = this.supabase.client
      .from('capacites')
      .select('*')
      .eq('semaine_debut', capacite.semaine_debut!);

    if (capacite.role_id) query = query.eq('role_id', capacite.role_id);
    if (capacite.personne_id) query = query.eq('personne_id', capacite.personne_id);
    if (capacite.equipe_id) query = query.eq('equipe_id', capacite.equipe_id);
    if (capacite.service_id) query = query.eq('service_id', capacite.service_id);
    if (capacite.departement_id) query = query.eq('departement_id', capacite.departement_id);
    if (capacite.societe_id) query = query.eq('societe_id', capacite.societe_id);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async setCapaciteForWeeks(
    weeks: Date[],
    capaciteValue: number,
    filters: {
      roleId?: string;
      personneId?: string;
      equipeId?: string;
      serviceId?: string;
      departementId?: string;
      societeId?: string;
    }
  ): Promise<void> {
    const promises = weeks.map(week => {
      const capacite: Partial<Capacite> = {
        semaine_debut: this.formatWeekStart(week),
        capacite: capaciteValue,
        role_id: filters.roleId,
        personne_id: filters.personneId,
        equipe_id: filters.equipeId,
        service_id: filters.serviceId,
        departement_id: filters.departementId,
        societe_id: filters.societeId
      };
      return this.setCapacite(capacite);
    });

    await Promise.all(promises);
  }

  async getCharges(projetId?: string): Promise<Charge[]> {
    let query = this.supabase.client
      .from('charges')
      .select('*');

    if (projetId) query = query.eq('projet_id', projetId);

    const { data, error } = await query.order('semaine_debut');
    if (error) throw error;
    return data || [];
  }

  async createCharge(charge: Partial<Charge>): Promise<Charge> {
    const { data, error } = await this.supabase.client
      .from('charges')
      .insert([charge])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCharge(id: string, charge: Partial<Charge>): Promise<Charge> {
    const { data, error } = await this.supabase.client
      .from('charges')
      .update(charge)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteCharge(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('charges')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async getJalons(projetId?: string): Promise<Jalon[]> {
    let query = this.supabase.client
      .from('jalons')
      .select('*');

    if (projetId) query = query.eq('projet_id', projetId);

    const { data, error } = await query.order('date_jalon');
    if (error) throw error;
    return data || [];
  }

  async createJalon(jalon: Partial<Jalon>): Promise<Jalon> {
    const { data, error } = await this.supabase.client
      .from('jalons')
      .insert([jalon])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  calculateDisponible(capacite: number, charge: number): number {
    return capacite - charge;
  }

  calculateJoursCharges(uniteRessource: number, joursParSemaine: number, nbWeeks: number): number {
    return uniteRessource * joursParSemaine * nbWeeks;
  }
}
