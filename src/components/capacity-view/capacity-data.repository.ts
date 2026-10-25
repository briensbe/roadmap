/**
 * @file capacity-data.repository.ts
 * @description Référentiel de données et coordinateur des services de persistance pour la vue de capacité (Deep Module).
 *
 * Responsabilités :
 * - Orchestrer les requêtes parallèles vers TeamService, RolesService et CrewdayzIntegrationService.
 * - Assembler les données brutes, indexer les capacités par ressource et construire l'arborescence TeamRow.
 * - Encapsuler les ajouts et retraits de ressources au sein des équipes.
 */

import { Injectable, inject } from '@angular/core';
import { TeamService } from '../../services/team.service';
import { CalendarService } from '../../services/calendar.service';
import { RolesService } from '../../services/roles.service';
import { CrewdayzIntegrationService } from '../../services/crewdayz-integration.service';
import { Role, Personne, Capacite } from '../../models/types';
import { CrewdayzTeamAvailability } from '../../models/crewdayz.types';
import {
  ResourceWeekData,
  ResourceRow,
  TeamRow,
  LoadedCapacityDataset,
} from './capacity-view.models';

@Injectable({
  providedIn: 'root',
})
export class CapacityDataRepository {
  readonly teamService = inject(TeamService);
  readonly calendarService = inject(CalendarService);
  readonly rolesService = inject(RolesService);
  readonly crewdayzService = inject(CrewdayzIntegrationService);

  /**
   * Charge l'ensemble des données nécessaires à la vue de capacité de manière concurrente.
   */
  async loadCapacityDataset(
    displayedWeeks: Date[],
    manualStates: Map<string, boolean>,
    isDefaultExpanded: boolean,
  ): Promise<LoadedCapacityDataset> {
    if (!displayedWeeks.length) {
      throw new Error('displayedWeeks must not be empty');
    }

    const startDateStr = this.calendarService.formatWeekStart(displayedWeeks[0]!);
    const endDateStr = this.calendarService.formatWeekStart(displayedWeeks[displayedWeeks.length - 1]!);

    // 1. Chargement parallèle des collections principales
    const [equipes, allCapacities, roles, personnes, roleAtts, mappings, availabilities, sourceConfigs] =
      await Promise.all([
        this.teamService.getAllEquipes(),
        this.teamService.getAllCapacities(),
        this.teamService.getAllRoles(),
        this.teamService.getAllPersonnes(),
        this.rolesService.getAllRoleAttachments(),
        this.crewdayzService.getMappings(),
        this.crewdayzService.getAvailabilities(startDateStr, endDateStr),
        this.crewdayzService.getCapacitySourceConfigs(),
      ]);

    // Chargement parallèle des ressources associées à chaque équipe
    const allResourcesArrays = await Promise.all(
      equipes.map((equipe) => this.teamService.getEquipeResources(equipe.id!)),
    );

    // 2. Indexation des capacités en mémoire pour lookup O(1)
    const capacitiesByResource = new Map<string, Capacite[]>();
    for (const cap of allCapacities) {
      const resourceId = cap.role_id || cap.personne_id;
      const type = cap.role_id ? 'role' : 'personne';
      const key = `${resourceId}_${type}_${cap.equipe_id}`;
      let list = capacitiesByResource.get(key);
      if (!list) {
        list = [];
        capacitiesByResource.set(key, list);
      }
      list.push(cap);
    }

    // 3. Construction des lignes TeamRow
    const teamRows: TeamRow[] = equipes.map((equipe, index) => {
      const resources = allResourcesArrays[index] || [];

      const resourceRows: ResourceRow[] = resources.map((resource) => {
        const key = `${resource.id}_${resource.type}_${equipe.id}`;
        const capacites = capacitiesByResource.get(key) || [];
        const weeks = new Map<string, number>();
        const weekData = new Map<string, ResourceWeekData>();

        for (const cap of capacites) {
          const weekStr = this.calendarService.formatWeekStart(new Date(cap.semaine_debut));
          weeks.set(weekStr, cap.capacite);
          weekData.set(weekStr, {
            capacite: cap.capacite,
            override_capacite: cap.override_capacite,
            override_delta: cap.override_delta,
            comment: cap.comment,
          });
        }

        return {
          type: resource.type,
          id: resource.id,
          uniqueId: resource.uniqueId,
          label: resource.type === 'role' ? resource.nom : `${resource.prenom} ${resource.nom}`,
          equipeId: equipe.id!,
          weeks,
          weekData,
          jours_par_semaine: resource.jours_par_semaine,
          color: resource.color,
        };
      });

      return {
        equipe,
        resources: resourceRows,
        expanded: manualStates.has(equipe.id!) ? manualStates.get(equipe.id!)! : isDefaultExpanded,
      };
    });

    return {
      allEquipes: equipes,
      availableRoles: roles,
      availablePersonnes: personnes,
      roleAttachmentsList: roleAtts,
      crewdayzMappings: mappings,
      crewdayzAvailabilities: availabilities,
      capacitySourceConfigs: sourceConfigs,
      teamRows,
    };
  }

  /**
   * Récupère les rôles et personnes non encore rattachés à une équipe donnée.
   */
  async loadAvailableResourcesForEquipe(
    equipeId: string,
  ): Promise<{ availableRoles: Role[]; availablePersonnes: Personne[] }> {
    const [availableRoles, availablePersonnes] = await Promise.all([
      this.teamService.getAvailableRolesForEquipe(equipeId),
      this.teamService.getAvailablePersonnesForEquipe(equipeId),
    ]);
    return { availableRoles, availablePersonnes };
  }

  /**
   * Associe une nouvelle ressource (rôle ou personne) à une équipe.
   */
  async addResourceToEquipe(equipeId: string, resourceId: string, type: 'role' | 'personne'): Promise<void> {
    if (type === 'role') {
      await this.teamService.addRoleToEquipe(equipeId, resourceId);
    } else {
      await this.teamService.addPersonneToEquipe(equipeId, resourceId);
    }
  }

  /**
   * Retire une ressource d'une équipe.
   */
  async removeResourceFromEquipe(resource: { id: string; type: 'role' | 'personne'; equipeId: string }): Promise<void> {
    if (resource.type === 'role') {
      await this.teamService.removeRoleFromEquipe(resource.id, resource.equipeId);
    } else {
      await this.teamService.removePersonneFromEquipe(resource.id);
    }
  }

  /**
   * Actualise uniquement les disponibilités Crewdayz sur une plage de semaines.
   */
  async fetchCrewdayzAvailabilities(
    startDateStr: string,
    endDateStr: string,
  ): Promise<CrewdayzTeamAvailability[]> {
    return this.crewdayzService.getAvailabilities(startDateStr, endDateStr);
  }
}
