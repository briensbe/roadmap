import { Injectable, OnDestroy } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { DB_TABLES } from '../constants/db-tables';
import {
  CapacitySource,
  CapacitySourceConfig,
  CrewdayzCacheStatus,
  CrewdayzDiscoveryResponse,
  CrewdayzTeamAvailability,
  RoadmapMappingRoleProfile,
} from '../models/crewdayz.types';
import { paginateQuery } from '../utils/supabase-pagination';

@Injectable({
  providedIn: 'root',
})
export class CrewdayzIntegrationService implements OnDestroy {
  private _discoveryCache: CrewdayzDiscoveryResponse | null = null;
  private _mappingsCache: RoadmapMappingRoleProfile[] | null = null;
  private _sourceConfigCache: CapacitySourceConfig[] | null = null;

  // In-Memory Cache des Disponibilités avec Invalidation événementielle en Temps Réel
  private _availabilitiesCache: CrewdayzTeamAvailability[] | null = null;
  private _cacheParamsKey: string | null = null;
  private _cachedAt: Date | null = null;
  private _lastCrewdayzEventAt: Date | null = null;
  private _isFetchingAvailabilities = false;
  private realtimeChannel: RealtimeChannel | null = null;

  constructor(private supabase: SupabaseService) {
    this.setupRealtimeSubscription();
  }

  ngOnDestroy(): void {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * Configure l'écoute Supabase Realtime sur la table roadmap_integration_events
   * Invalide automatiquement le cache des disponibilités dès qu'un nouvel événement 'crewdayz' survient.
   */
  private setupRealtimeSubscription(): void {
    this.realtimeChannel = this.supabase.client
      .channel('roadmap-integration-events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: DB_TABLES.INTEGRATION_EVENTS,
        },
        (payload) => {
          const newRecord = payload.new as { source?: string; created_at?: string } | null;
          if (!newRecord?.source || newRecord.source === 'crewdayz') {
            console.log('[CrewdayzIntegrationService] Événement Realtime reçu sur roadmap_integration_events, invalidation du cache :', payload);
            if (newRecord?.created_at) {
              this._lastCrewdayzEventAt = new Date(newRecord.created_at);
            } else {
              this._lastCrewdayzEventAt = new Date();
            }
            this._availabilitiesCache = null;
          }
        }
      )
      .subscribe();
  }

  /**
   * Retourne l'état actuel du cache en mémoire et l'horodatage des événements
   */
  getCacheStatus(): CrewdayzCacheStatus {
    const isStale =
      !this._availabilitiesCache ||
      !this._cachedAt ||
      (!!this._lastCrewdayzEventAt && this._lastCrewdayzEventAt.getTime() > this._cachedAt.getTime());

    return {
      cachedAt: this._cachedAt,
      lastCrewdayzEventAt: this._lastCrewdayzEventAt,
      isStale,
      isFetching: this._isFetchingAvailabilities,
    };
  }

  /**
   * Récupère la liste hiérarchique des équipes et profils Crewdayz (API Discovery)
   */
  async getDiscovery(forceRefresh = false): Promise<CrewdayzDiscoveryResponse> {
    if (this._discoveryCache && !forceRefresh) {
      return this._discoveryCache;
    }

    const { data, error } = await this.supabase.client.rpc('cd_get_teams_discovery');
    if (error) {
      console.error('[CrewdayzIntegrationService] Error calling cd_get_teams_discovery:', error);
      return { equipes: [] };
    }

    this._discoveryCache = (data as CrewdayzDiscoveryResponse) || { equipes: [] };
    return this._discoveryCache;
  }

  /**
   * Récupère les disponibilités par équipe, profil et semaine pour une plage de dates.
   * Utilise le cache en mémoire et se fie au canal Realtime pour les invalidations.
   */
  async getAvailabilities(
    startDate: string,
    endDate: string,
    teamName?: string,
    forceRefresh = false
  ): Promise<CrewdayzTeamAvailability[]> {
    const currentParamsKey = `${startDate}_${endDate}_${teamName || 'all'}`;

    // 1. Si le cache existe pour ces mêmes paramètres et qu'un rafraîchissement n'est pas forcé -> 0ms !
    if (this._availabilitiesCache && this._cacheParamsKey === currentParamsKey && !forceRefresh) {
      return this._availabilitiesCache;
    }

    // 2. Si le cache est absent, obsolète ou réclamé explicitement -> Appel de la RPC
    this._isFetchingAvailabilities = true;
    try {
      const { data, error } = await this.supabase.client.rpc('cd_get_availabilities', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_team_name: teamName || null,
      });

      if (error) {
        console.error('[CrewdayzIntegrationService] Error calling cd_get_availabilities:', error);
        return this._availabilitiesCache || [];
      }

      this._availabilitiesCache = (data as CrewdayzTeamAvailability[]) || [];
      this._cacheParamsKey = currentParamsKey;
      this._cachedAt = new Date();
      return this._availabilitiesCache;
    } finally {
      this._isFetchingAvailabilities = false;
    }
  }


  /**
   * Récupère les règles de mapping Roadmap <-> Crewdayz
   */
  async getMappings(forceRefresh = false): Promise<RoadmapMappingRoleProfile[]> {
    if (this._mappingsCache && !forceRefresh) {
      return this._mappingsCache;
    }

    const data = await paginateQuery<RoadmapMappingRoleProfile>(() =>
      this.supabase.client
        .from(DB_TABLES.MAPPING_ROLES_PROFILES)
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    );

    this._mappingsCache = data || [];
    return this._mappingsCache;
  }

  /**
   * Enregistre un nouveau mapping ou met à jour un mapping existant
   */
  async saveMapping(
    mapping: Partial<RoadmapMappingRoleProfile>
  ): Promise<RoadmapMappingRoleProfile> {
    this._mappingsCache = null;

    const { id, ...payload } = mapping;

    if (id) {
      const { data, error } = await this.supabase.client
        .from(DB_TABLES.MAPPING_ROLES_PROFILES)
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase.client
        .from(DB_TABLES.MAPPING_ROLES_PROFILES)
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /**
   * Supprime un mapping par son ID
   */
  async deleteMapping(id: string): Promise<void> {
    this._mappingsCache = null;
    const { error } = await this.supabase.client
      .from(DB_TABLES.MAPPING_ROLES_PROFILES)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Calcule le nombre d'unités de ressource (disponibilité ETP) pour un élément Roadmap et une date de semaine données.
   *
   * @param weekStartDate String au format YYYY-MM-DD (semaine_debut dans Roadmap)
   * @param attachmentOrTeamId ID de l'attachment de rôle ou de l'équipe Roadmap
   * @param personneId ID de la personne Roadmap (optionnel)
   * @param availabilities Liste des disponibilités renvoyées par la RPC Crewdayz
   * @param mappings Liste des règles de mapping
   */
  calculateAvailableCount(
    weekStartDate: string,
    attachmentOrTeamId: string,
    personneId: string | null,
    teamId: string,
    availabilities: CrewdayzTeamAvailability[],
    mappings: RoadmapMappingRoleProfile[]
  ): number | null {
    // 1. Filtrer les règles de mapping applicables à cette ressource / rôle / équipe Roadmap
    const relevantMappings = mappings.filter((m) => {
      if (personneId && m.roadmap_personne_id === personneId) return true;
      if (m.roadmap_role_attachment_id && m.roadmap_role_attachment_id === attachmentOrTeamId) return true;
      if (m.roadmap_team_id && m.roadmap_team_id === teamId && !m.roadmap_role_attachment_id && !m.roadmap_personne_id) return true;
      return false;
    });

    if (relevantMappings.length === 0) {
      return null;
    }

    let totalAvailableEtp = 0;

    // Normalize weekStartDate to YYYY-MM-DD
    const targetWeekStart = weekStartDate.substring(0, 10);

    for (const mapping of relevantMappings) {
      const ratio = mapping.availability_ratio ?? 1.0;
      if (ratio === 0) continue;

      // Retrouver l'équipe Crewdayz correspondante
      const teamData = availabilities.find(
        (t) => t.teamName.trim().toLowerCase() === mapping.crewdayz_team_name.trim().toLowerCase()
      );
      if (!teamData) continue;

      // Retrouver le profil Crewdayz correspondant
      const profileData = teamData.profiles.find(
        (p) => p.profileName.trim().toLowerCase() === mapping.crewdayz_profile_name.trim().toLowerCase()
      );
      if (!profileData) continue;

      // Retrouver la semaine correspondante par sa date de début (startDate)
      const weekData = profileData.weeks.find((w) => w.startDate === targetWeekStart);
      if (!weekData) continue;

      // standard 5 jours travaillés par membre par semaine
      const daysPerMember = weekData.membersCount > 0 ? (weekData.capacityDays / weekData.membersCount) : 5.0;
      const baseDays = daysPerMember > 0 ? daysPerMember : 5.0;

      const profileEtp = (weekData.availableDays / baseDays) * ratio;
      totalAvailableEtp += profileEtp;
    }

    return Math.round(totalAvailableEtp * 100) / 100;
  }

  // ============================================
  // CAPACITY SOURCE CONFIG
  // ============================================

  /**
   * Récupère la configuration de source de capacité pour toutes les équipes.
   * Si une équipe n'a pas de config, elle est considérée comme 'roadmap' (défaut).
   */
  async getCapacitySourceConfigs(forceRefresh = false): Promise<CapacitySourceConfig[]> {
    if (this._sourceConfigCache && !forceRefresh) return this._sourceConfigCache;

    const data = await paginateQuery<CapacitySourceConfig>(() =>
      this.supabase.client
        .from(DB_TABLES.CAPACITY_SOURCE_CONFIG)
        .select('*')
        .order('id', { ascending: true })
    );

    this._sourceConfigCache = data || [];
    return this._sourceConfigCache;
  }

  /**
   * Définit la source de capacité pour une équipe (upsert).
   * Ne touche pas aux mappings existants.
   */
  async setCapacitySource(equipeId: string, source: CapacitySource): Promise<void> {
    this._sourceConfigCache = null;

    const { error } = await this.supabase.client
      .from(DB_TABLES.CAPACITY_SOURCE_CONFIG)
      .upsert(
        {
          equipe_id: equipeId,
          capacity_source: source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'equipe_id' }
      );

    if (error) throw error;
  }

  /**
   * Retourne la source de capacité effective pour une équipe donnée.
   * Défaut : 'roadmap' si aucune config n'existe pour cette équipe.
   */
  getSourceForTeam(equipeId: string, configs: CapacitySourceConfig[]): CapacitySource {
    const config = configs.find((c) => c.equipe_id === equipeId);
    return config?.capacity_source ?? 'roadmap';
  }
}
