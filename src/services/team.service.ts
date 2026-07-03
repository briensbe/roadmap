import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DataSyncService } from './data-sync.service';
import { Equipe, Role, Personne, Capacite, EquipeResource } from '../models/types';
import { DB_TABLES } from '../constants/db-tables';
import { paginateQuery } from '../utils/supabase-pagination';

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  // Caches
  private _equipesCache: Equipe[] | null = null;
  private _rolesCache: Role[] | null = null;
  private _personnesCache: Personne[] | null = null;
  private _equipeResourcesCache = new Map<string, EquipeResource[]>();
  private _capacitesCache = new Map<string, Capacite[]>();
  private _allCapacitiesCache: Capacite[] | null = null;

  constructor(
    private supabase: SupabaseService,
    private dataSync: DataSyncService,
  ) {
    // Subscribe to global sync events to clear local cache
    this.dataSync.sync$.subscribe(() => this.clearLocalCache());
  }

  public clearCache() {
    this.clearLocalCache();
    this.dataSync.notifyChange();
  }

  private clearLocalCache() {
    this._equipesCache = null;
    this._rolesCache = null;
    this._personnesCache = null;
    this._equipeResourcesCache.clear();
    this._capacitesCache.clear();
    this._allCapacitiesCache = null;
  }

  async getAllEquipes(): Promise<Equipe[]> {
    if (this._equipesCache) {
      return this._equipesCache;
    }

    const data = await paginateQuery<Equipe>(() =>
      this.supabase.client.from(DB_TABLES.EQUIPES).select('*').order('nom'),
    );

    this._equipesCache = data || [];
    return this._equipesCache;
  }

  async getEquipeResources(equipeId: string): Promise<EquipeResource[]> {
    if (this._equipeResourcesCache.has(equipeId)) {
      return this._equipeResourcesCache.get(equipeId)!;
    }

    const resources: EquipeResource[] = [];

    // Get roles attached to this team
    const roleAttachments = await paginateQuery<any>(() =>
      this.supabase.client
        .from(DB_TABLES.ROLE_ATTACHMENTS)
        .select(`id, role_id, roles:${DB_TABLES.ROLES}(*)`) // attention on met roles: pour ne pas avoir à changer le reste du code suite renommage table
        .eq('equipe_id', equipeId),
    );

    if (roleAttachments) {
      roleAttachments.forEach((attachment: any) => {
        if (attachment.roles) {
          resources.push({
            type: 'role',
            id: attachment.roles.id,
            uniqueId: attachment.id,
            nom: attachment.roles.nom,
            jours_par_semaine: attachment.roles.jours_par_semaine,
            color: attachment.roles.color,
          });
        }
      });
    }

    // Get persons attached to this team
    const personnes = await paginateQuery<any>(() =>
      this.supabase.client.from(DB_TABLES.PERSONNES).select('*').eq('equipe_id', equipeId),
    );

    if (personnes) {
      personnes.forEach((personne: any) => {
        resources.push({
          type: 'personne',
          id: personne.id,
          uniqueId: personne.id,
          nom: personne.nom,
          prenom: personne.prenom,
          jours_par_semaine: personne.jours_par_semaine,
          color: personne.color,
        });
      });
    }

    this._equipeResourcesCache.set(equipeId, resources);
    return resources;
  }

  async getAllRoles(): Promise<Role[]> {
    if (this._rolesCache) {
      return this._rolesCache;
    }

    const data = await paginateQuery<Role>(() => this.supabase.client.from(DB_TABLES.ROLES).select('*').order('nom'));

    this._rolesCache = data || [];
    return this._rolesCache;
  }

  async getAvailableRolesForEquipe(equipeId: string): Promise<Role[]> {
    // Get all roles
    const allRoles = await this.getAllRoles();

    // Get roles already attached to THIS specific team
    const attachments = await paginateQuery<any>(() =>
      this.supabase.client.from(DB_TABLES.ROLE_ATTACHMENTS).select('role_id').eq('equipe_id', equipeId),
    );

    // Extract role IDs already attached to this team
    const attachedRoleIds = new Set((attachments || []).map((a) => a.role_id));

    // Filter out roles that are already attached to THIS team
    return allRoles.filter((role) => !attachedRoleIds.has(role.id!));
  }

  async getAllPersonnes(): Promise<Personne[]> {
    if (this._personnesCache) {
      return this._personnesCache;
    }

    const data = await paginateQuery<Personne>(() =>
      this.supabase.client.from(DB_TABLES.PERSONNES).select('*').order('nom', { ascending: true }),
    );

    this._personnesCache = data || [];
    return this._personnesCache;
  }

  async getAvailablePersonnesForEquipe(equipeId: string): Promise<Personne[]> {
    // Get all persons
    const allPersonnes = await this.getAllPersonnes();

    // Get persons already attached to THIS specific team
    const personnes = await paginateQuery<any>(() =>
      this.supabase.client.from(DB_TABLES.PERSONNES).select('id').eq('equipe_id', equipeId),
    );

    // Extract person IDs already attached to this team
    const attachedPersonIds = new Set((personnes || []).map((p) => p.id));

    // Filter out persons that are already attached to THIS team
    return allPersonnes.filter((personne) => !attachedPersonIds.has(personne.id!));
  }

  async addRoleToEquipe(equipeId: string, roleId: string): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.ROLE_ATTACHMENTS).insert({
      role_id: roleId,
      equipe_id: equipeId,
    });

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505' || error.message.includes('unique_role_per_team')) {
        throw new Error('Ce rôle est déjà attaché à cette équipe.');
      }
      throw error;
    }
    this.clearCache();
  }

  async addPersonneToEquipe(equipeId: string, personneId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from(DB_TABLES.PERSONNES)
      .update({ equipe_id: equipeId })
      .eq('id', personneId);

    if (error) throw error;
    this.clearCache();
  }

  async removeRoleFromEquipe(roleId: string, equipeId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from(DB_TABLES.ROLE_ATTACHMENTS)
      .delete()
      .eq('role_id', roleId)
      .eq('equipe_id', equipeId);

    if (error) throw error;
    this.clearCache();
  }

  async removePersonneFromEquipe(personneId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from(DB_TABLES.PERSONNES)
      .update({ equipe_id: null })
      .eq('id', personneId);

    if (error) throw error;
    this.clearCache();
  }

  async getCapacites(resourceId: string, type: 'role' | 'personne', equipeId: string): Promise<Capacite[]> {
    const cacheKey = `${resourceId}:${type}:${equipeId}`;
    if (this._capacitesCache.has(cacheKey)) {
      return this._capacitesCache.get(cacheKey)!;
    }

    const result = await paginateQuery<Capacite>(() => {
      let query = this.supabase.client.from(DB_TABLES.CAPACITES).select('*').eq('equipe_id', equipeId);

      if (type === 'role') {
        query = query.eq('role_id', resourceId);
      } else {
        query = query.eq('personne_id', resourceId);
      }
      return query.order('semaine_debut');
    });

    this._capacitesCache.set(cacheKey, result);
    return result;
  }

  async saveCapacite(
    resourceId: string,
    type: 'role' | 'personne',
    equipeId: string,
    semaineDebut: string,
    capacite: number,
  ): Promise<void> {
    const capaciteData: any = {
      semaine_debut: semaineDebut,
      capacite: capacite,
      equipe_id: equipeId,
    };

    if (type === 'role') {
      capaciteData.role_id = resourceId;
    } else {
      capaciteData.personne_id = resourceId;
    }

    // Check if capacity already exists for this week
    const query = this.supabase.client
      .from(DB_TABLES.CAPACITES)
      .select('id')
      .eq('semaine_debut', semaineDebut)
      .eq('equipe_id', equipeId);

    if (type === 'role') {
      query.eq('role_id', resourceId);
    } else {
      query.eq('personne_id', resourceId);
    }

    const { data: existing } = await query.single();

    if (existing) {
      // Update existing
      const { error } = await this.supabase.client.from(DB_TABLES.CAPACITES).update({ capacite }).eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insert new
      const { error } = await this.supabase.client.from(DB_TABLES.CAPACITES).insert(capaciteData);

      if (error) throw error;
    }
    this.clearCache();
  }

  async deleteCapacite(resourceId: string, type: 'role' | 'personne', semaineDebut: string): Promise<void> {
    const query = this.supabase.client.from(DB_TABLES.CAPACITES).delete().eq('semaine_debut', semaineDebut);

    if (type === 'role') {
      query.eq('role_id', resourceId);
    } else {
      query.eq('personne_id', resourceId);
    }

    const { error } = await query;
    if (error) throw error;
    this.clearCache();
  }
  async getAllCapacities(): Promise<Capacite[]> {
    if (this._allCapacitiesCache) {
      return this._allCapacitiesCache;
    }

    const data = await paginateQuery<Capacite>(() => this.supabase.client.from(DB_TABLES.CAPACITES).select('*'));

    this._allCapacitiesCache = data || [];
    return this._allCapacitiesCache;
  }
}
