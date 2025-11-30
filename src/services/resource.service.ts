import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Societe, Departement, Service, Equipe, Role, Personne } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(private supabase: SupabaseService) {}

  async getAllSocietes(): Promise<Societe[]> {
    const { data, error } = await this.supabase.client
      .from('societes')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  async createSociete(societe: Partial<Societe>): Promise<Societe> {
    const { data, error } = await this.supabase.client
      .from('societes')
      .insert([societe])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAllDepartements(): Promise<Departement[]> {
    const { data, error } = await this.supabase.client
      .from('departements')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  async createDepartement(departement: Partial<Departement>): Promise<Departement> {
    const { data, error } = await this.supabase.client
      .from('departements')
      .insert([departement])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAllServices(): Promise<Service[]> {
    const { data, error } = await this.supabase.client
      .from('services')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  async createService(service: Partial<Service>): Promise<Service> {
    const { data, error } = await this.supabase.client
      .from('services')
      .insert([service])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAllEquipes(): Promise<Equipe[]> {
    const { data, error } = await this.supabase.client
      .from('equipes')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  async createEquipe(equipe: Partial<Equipe>): Promise<Equipe> {
    const { data, error } = await this.supabase.client
      .from('equipes')
      .insert([equipe])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAllRoles(): Promise<Role[]> {
    const { data, error } = await this.supabase.client
      .from('roles')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  async createRole(role: Partial<Role>): Promise<Role> {
    const { data, error } = await this.supabase.client
      .from('roles')
      .insert([role])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAllPersonnes(): Promise<Personne[]> {
    const { data, error } = await this.supabase.client
      .from('personnes')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  async createPersonne(personne: Partial<Personne>): Promise<Personne> {
    const { data, error } = await this.supabase.client
      .from('personnes')
      .insert([personne])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updatePersonne(id: string, personne: Partial<Personne>): Promise<Personne> {
    const { data, error } = await this.supabase.client
      .from('personnes')
      .update(personne)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async addRoleToPersonne(personneId: string, roleId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('personne_roles')
      .insert([{ personne_id: personneId, role_id: roleId }]);
    if (error) throw error;
  }
}
