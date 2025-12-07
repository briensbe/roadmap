import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Societe, Departement, Service, Equipe, Role, Personne } from "../models/types";

@Injectable({
  providedIn: "root",
})
export class ResourceService {
  // Simple in-memory caches
  private _societesCache: Societe[] | null = null;
  private _departementsCache: Departement[] | null = null;
  private _servicesCache: Service[] | null = null;
  private _equipesCache: Equipe[] | null = null;
  private _rolesCache: Role[] | null = null;
  private _personnesCache: Personne[] | null = null;

  constructor(private supabase: SupabaseService) {}

  private clearCache() {
    this._societesCache = null;
    this._departementsCache = null;
    this._servicesCache = null;
    this._equipesCache = null;
    this._rolesCache = null;
    this._personnesCache = null;
  }

  async getAllSocietes(): Promise<Societe[]> {
    if (this._societesCache) return this._societesCache;
    const { data, error } = await this.supabase.client.from("societes").select("*").order("nom");
    if (error) throw error;

    this._societesCache = data || [];
    return this._societesCache;
  }

  async createSociete(societe: Partial<Societe>): Promise<Societe> {
    const { data, error } = await this.supabase.client.from("societes").insert([societe]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllDepartements(): Promise<Departement[]> {
    if (this._departementsCache) return this._departementsCache;
    const { data, error } = await this.supabase.client.from("departements").select("*").order("nom");
    if (error) throw error;

    this._departementsCache = data || [];
    return this._departementsCache;
  }

  async createDepartement(departement: Partial<Departement>): Promise<Departement> {
    const { data, error } = await this.supabase.client.from("departements").insert([departement]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllServices(): Promise<Service[]> {
    if (this._servicesCache) return this._servicesCache;
    const { data, error } = await this.supabase.client.from("services").select("*").order("nom");
    if (error) throw error;

    this._servicesCache = data || [];
    return this._servicesCache;
  }

  async createService(service: Partial<Service>): Promise<Service> {
    const { data, error } = await this.supabase.client.from("services").insert([service]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllEquipes(): Promise<Equipe[]> {
    if (this._equipesCache) return this._equipesCache;
    const { data, error } = await this.supabase.client.from("equipes").select("*").order("nom");
    if (error) throw error;

    this._equipesCache = data || [];
    return this._equipesCache;
  }

  async createEquipe(equipe: Partial<Equipe>): Promise<Equipe> {
    const { data, error } = await this.supabase.client.from("equipes").insert([equipe]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllRoles(): Promise<Role[]> {
    if (this._rolesCache) return this._rolesCache;
    const { data, error } = await this.supabase.client.from("roles").select("*").order("nom");
    if (error) throw error;

    this._rolesCache = data || [];
    return this._rolesCache;
  }

  async createRole(role: Partial<Role>): Promise<Role> {
    const { data, error } = await this.supabase.client.from("roles").insert([role]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async getAllPersonnes(): Promise<Personne[]> {
    if (this._personnesCache) return this._personnesCache;
    const { data, error } = await this.supabase.client.from("personnes").select("*").order("nom");
    if (error) throw error;

    this._personnesCache = data || [];
    return this._personnesCache;
  }

  async createPersonne(personne: Partial<Personne>): Promise<Personne> {
    const { data, error } = await this.supabase.client.from("personnes").insert([personne]).select().single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async updatePersonne(id: string, personne: Partial<Personne>): Promise<Personne> {
    const { data, error } = await this.supabase.client
      .from("personnes")
      .update(personne)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    this.clearCache();
    return data;
  }

  async addRoleToPersonne(personneId: string, roleId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("personne_roles")
      .insert([{ personne_id: personneId, role_id: roleId }]);
    if (error) throw error;
    this.clearCache();
  }
}
