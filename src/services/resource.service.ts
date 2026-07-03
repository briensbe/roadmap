import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DataSyncService } from './data-sync.service';
import { Societe, Departement, Service, Equipe, Role, Personne } from '../models/types';
import { DB_TABLES } from '../constants/db-tables';
import { paginateQuery } from '../utils/supabase-pagination';

@Injectable({
  providedIn: 'root',
})
export class ResourceService {
  // Simple in-memory caches
  private _societesCache: Societe[] | null = null;
  private _departementsCache: Departement[] | null = null;
  private _servicesCache: Service[] | null = null;
  private _equipesCache: Equipe[] | null = null;
  private _rolesCache: Role[] | null = null;
  private _personnesCache: Personne[] | null = null;

  constructor(
    private supabase: SupabaseService,
    private dataSync: DataSyncService,
  ) {
    this.dataSync.sync$.subscribe(() => this.clearLocalCache());
  }

  private clearCache() {
    this.clearLocalCache();
    this.dataSync.notifyChange();
  }

  private clearLocalCache() {
    this._societesCache = null;
    this._departementsCache = null;
    this._servicesCache = null;
    this._equipesCache = null;
    this._rolesCache = null;
    this._personnesCache = null;
  }

  async getAllSocietes(): Promise<Societe[]> {
    if (this._societesCache) return this._societesCache;
    const data = await paginateQuery<Societe>(() =>
      this.supabase.client.from(DB_TABLES.SOCIETES).select('*').order('nom'),
    );

    this._societesCache = data || [];
    return this._societesCache;
  }

  async createSociete(societe: Partial<Societe>): Promise<Societe> {
    const { data, error } = await this.supabase.client.from(DB_TABLES.SOCIETES).insert([societe]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllDepartements(): Promise<Departement[]> {
    if (this._departementsCache) return this._departementsCache;
    const data = await paginateQuery<Departement>(() =>
      this.supabase.client.from(DB_TABLES.DEPARTEMENTS).select('*').order('nom'),
    );

    this._departementsCache = data || [];
    return this._departementsCache;
  }

  async createDepartement(departement: Partial<Departement>): Promise<Departement> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.DEPARTEMENTS)
      .insert([departement])
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllServices(): Promise<Service[]> {
    if (this._servicesCache) return this._servicesCache;
    const data = await paginateQuery<Service>(() =>
      this.supabase.client.from(DB_TABLES.SERVICES).select('*').order('nom'),
    );

    this._servicesCache = data || [];
    return this._servicesCache;
  }

  async createService(service: Partial<Service>): Promise<Service> {
    const { data, error } = await this.supabase.client.from(DB_TABLES.SERVICES).insert([service]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllEquipes(): Promise<Equipe[]> {
    if (this._equipesCache) return this._equipesCache;
    const data = await paginateQuery<Equipe>(() =>
      this.supabase.client.from(DB_TABLES.EQUIPES).select('*').order('nom'),
    );

    this._equipesCache = data || [];
    return this._equipesCache;
  }

  async createEquipe(equipe: Partial<Equipe>): Promise<Equipe> {
    const { data, error } = await this.supabase.client.from(DB_TABLES.EQUIPES).insert([equipe]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllRoles(): Promise<Role[]> {
    if (this._rolesCache) return this._rolesCache;
    const data = await paginateQuery<Role>(() => this.supabase.client.from(DB_TABLES.ROLES).select('*').order('nom'));

    this._rolesCache = data || [];
    return this._rolesCache;
  }

  async createRole(role: Partial<Role>): Promise<Role> {
    const { data, error } = await this.supabase.client.from(DB_TABLES.ROLES).insert([role]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async updateRole(id: string, role: Partial<Role>): Promise<Role> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.ROLES)
      .update(role)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteRole(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.ROLES).delete().eq('id', id);
    if (error) throw error;
    this.clearCache();
  }

  async getAllPersonnes(): Promise<Personne[]> {
    if (this._personnesCache) return this._personnesCache;
    const data = await paginateQuery<Personne>(() =>
      this.supabase.client.from(DB_TABLES.PERSONNES).select('*').order('nom'),
    );

    this._personnesCache = data || [];
    return this._personnesCache;
  }

  async createPersonne(personne: Partial<Personne>): Promise<Personne> {
    const { data, error } = await this.supabase.client.from(DB_TABLES.PERSONNES).insert([personne]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deletePersonne(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.PERSONNES).delete().eq('id', id);
    if (error) throw error;
    this.clearCache();
  }

  async updatePersonne(id: string, personne: Partial<Personne>): Promise<Personne> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.PERSONNES)
      .update(personne)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async addRoleToPersonne(personneId: string, roleId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from(DB_TABLES.PERSONNE_ROLES)
      .insert([{ personne_id: personneId, role_id: roleId }]);
    if (error) throw error;
    this.clearCache();
  }

  // Societes
  async updateSociete(id: string, societe: Partial<Societe>): Promise<Societe> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.SOCIETES)
      .update(societe)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteSociete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.SOCIETES).delete().eq('id', id);
    if (error) throw error;
    this.clearCache();
  }

  // Departements
  async updateDepartement(id: string, departement: Partial<Departement>): Promise<Departement> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.DEPARTEMENTS)
      .update(departement)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteDepartement(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.DEPARTEMENTS).delete().eq('id', id);
    if (error) throw error;
    this.clearCache();
  }

  // Services
  async updateService(id: string, service: Partial<Service>): Promise<Service> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.SERVICES)
      .update(service)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteService(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.SERVICES).delete().eq('id', id);
    if (error) throw error;
    this.clearCache();
  }

  // Equipes
  async updateEquipe(id: string, equipe: Partial<Equipe>): Promise<Equipe> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.EQUIPES)
      .update(equipe)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteEquipe(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.EQUIPES).delete().eq('id', id);
    if (error) throw error;
    this.clearCache();
  }
}
