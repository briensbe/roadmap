/**
 * @file plan-data.repository.ts
 * @description Façade d'accès aux données, d'indexation des capacités et de mutations CRUD (Deep Module).
 *
 * Responsabilités :
 * - Orchestrer le chargement parallèle des 11 services métiers et construire l'index hybride des capacités
 *   (`capacityIndex`) combinant les données Crewdayz et les capacités saisies dans Roadmap.
 * - Unifier la résolution de la cible `(projetId, equipeId, roleId, personneId)` quel que soit le mode de vue actif
 *   via `resolveResourceTarget`.
 * - Exécuter les mutations unitaires et en masse (déplacement de charges, saisie groupée, projection de charge,
 *   liaison projet/équipe/ressource, recalcul de rang LexoRank).
 * - Gérer l'export Excel (`.xlsx`) de la planification et le lancement du tutoriel interactif (`driver.js`).
 */
import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { driver } from 'driver.js';
import { TeamService } from '../../services/team.service';
import { ProjetService } from '../../services/projet.service';
import { ChargeService } from '../../services/charge.service';
import { RolesService } from '../../services/roles.service';
import { JalonService } from '../../services/jalon.service';
import { PersonnesService } from '../../services/personnes.service';
import { ChiffresService } from '../../services/chiffres.service';
import { ResourceService } from '../../services/resource.service';
import { CrewdayzIntegrationService } from '../../services/crewdayz-integration.service';
import { SettingsService } from '../../services/settings.service';
import { CalendarService } from '../../services/calendar.service';
import { ThemeService } from '../../services/theme.service';
import { Capacite, Projet, Role, Personne, Equipe } from '../../models/types';
import { calculateNewRank, sortByRank } from '../../utils/lexorank.utils';
import {
  PlanViewMode,
  ResourceRow,
  ChildRow,
  ParentRow,
  SelectedCell,
  ResourceTarget,
  RoleAttachmentRecord,
  PlanRawDataset,
} from './plan-view.models';
import { formatWeekStart } from './plan-projection.engine';

@Injectable({
  providedIn: 'root',
})
export class PlanDataRepository {
  public readonly teamService = inject(TeamService);
  public readonly projetService = inject(ProjetService);
  public readonly chargeService = inject(ChargeService);
  public readonly rolesService = inject(RolesService);
  public readonly jalonService = inject(JalonService);
  public readonly personnesService = inject(PersonnesService);
  public readonly chiffresService = inject(ChiffresService);
  public readonly resourceService = inject(ResourceService);
  public readonly crewdayzService = inject(CrewdayzIntegrationService);
  public readonly settingsService = inject(SettingsService);
  public readonly calendarService = inject(CalendarService);
  public readonly themeService = inject(ThemeService);

  async loadDataset(
    displayedWeeks: Date[],
    capacityIndex: Map<string, number>,
  ): Promise<Omit<PlanRawDataset, 'capacityIndex' | 'usageMap'>> {
    const [
      equipes,
      charges,
      projects,
      roles,
      personnes,
      jalons,
      links,
      roleAttachments,
      capacities,
      chiffres,
      services,
    ] = await Promise.all([
      this.teamService.getAllEquipes(),
      this.chargeService.getAllCharges(),
      this.projetService.getAllProjets(),
      this.rolesService.getAllRoles(),
      this.personnesService.getAllPersonnes(),
      this.jalonService.getAllJalons(),
      this.projetService.getAllEquipeProjetLinks(),
      this.rolesService.getAllRoleAttachments() as Promise<RoleAttachmentRecord[]>,
      this.teamService.getAllCapacities(),
      this.chiffresService.getAllChiffres(),
      this.resourceService.getAllServices(),
    ]);

    await this.buildCapacityIndex(
      equipes,
      capacities,
      roleAttachments,
      personnes,
      displayedWeeks,
      capacityIndex,
    );

    return {
      allEquipes: equipes,
      allCharges: charges,
      allProjects: projects,
      availableRoles: roles,
      availablePersonnes: personnes,
      allJalons: jalons,
      allLinks: links,
      allRoleAttachments: roleAttachments,
      allCapacities: capacities,
      allChiffres: chiffres,
      allServices: services,
    };
  }

  /**
   * Construit et met à jour l'index hybride des capacités (Roadmap + Crewdayz).
   * Pour les équipes en source 'crewdayz', calcule la capacité effective en appelant
   * les RPCs Crewdayz pour la plage temporelle des semaines affichées.
   */
  async buildCapacityIndex(
    equipes: Equipe[],
    capacities: Capacite[],
    roleAttachments: RoleAttachmentRecord[],
    personnes: Personne[],
    displayedWeeks: Date[],
    capacityIndex: Map<string, number>,
  ): Promise<void> {
    const capacitySourceConfigs = await this.crewdayzService.getCapacitySourceConfigs();
    const crewdayzTeamIds = new Set(
      equipes
        .filter((eq) => this.crewdayzService.getSourceForTeam(eq.id!, capacitySourceConfigs) === 'crewdayz')
        .map((eq) => eq.id!),
    );

    capacityIndex.clear();
    const capacityMap = new Map<string, Capacite>();
    capacities.forEach((c) => {
      const weekKey = c.semaine_debut.split('T')[0];
      const rId = c.role_id || c.personne_id;
      const type = c.role_id ? 'role' : 'personne';
      const key = `${c.equipe_id}_${type}_${rId}_${weekKey}`;
      capacityMap.set(key, c);
      capacityIndex.set(key, c.capacite);
    });

    if (crewdayzTeamIds.size > 0 && displayedWeeks.length > 0) {
      const startDateStr = formatWeekStart(displayedWeeks[0]);
      const endDateStr = formatWeekStart(displayedWeeks[displayedWeeks.length - 1]);
      const [mappings, availabilities] = await Promise.all([
        this.crewdayzService.getMappings(),
        this.crewdayzService.getAvailabilities(startDateStr, endDateStr),
      ]);

      for (const equipe of equipes) {
        if (!crewdayzTeamIds.has(equipe.id!)) continue;

        const teamRoleAtts = roleAttachments.filter((att) => att.equipe_id === equipe.id);
        const teamPersonnes = personnes.filter((p) => p.equipe_id === equipe.id);

        for (const week of displayedWeeks) {
          const weekStr = formatWeekStart(week);

          for (const att of teamRoleAtts) {
            if (!att.id) continue;
            const key = `${equipe.id!}_role_${att.role_id}_${weekStr}`;
            const custom = capacityMap.get(key);
            const crewdayzBase = this.crewdayzService.calculateAvailableCount(
              weekStr,
              att.id,
              null,
              equipe.id!,
              availabilities,
              mappings,
            );
            const effectiveCap = this.crewdayzService.getEffectiveCapacity(
              'crewdayz',
              custom?.capacite || 0,
              crewdayzBase,
              custom?.override_capacite,
              custom?.override_delta,
            );
            capacityIndex.set(key, effectiveCap);
          }

          for (const p of teamPersonnes) {
            const key = `${equipe.id!}_personne_${p.id!}_${weekStr}`;
            const custom = capacityMap.get(key);
            const crewdayzBase = this.crewdayzService.calculateAvailableCount(
              weekStr,
              equipe.id!,
              p.id!,
              equipe.id!,
              availabilities,
              mappings,
            );
            const effectiveCap = this.crewdayzService.getEffectiveCapacity(
              'crewdayz',
              custom?.capacite || 0,
              crewdayzBase,
              custom?.override_capacite,
              custom?.override_delta,
            );
            capacityIndex.set(key, effectiveCap);
          }
        }
      }
    }
  }

  /**
   * Centralise la résolution de l'identité métier (projetId, equipeId, roleId, personneId)
   * à partir d'une cellule ou ligne selon le mode de vue courant.
   */
  resolveResourceTarget(
    viewMode: PlanViewMode,
    parentId: string,
    childId: string,
    resource: ResourceRow,
  ): ResourceTarget {
    let projetId: string;
    let equipeId: string;

    if (viewMode === 'project') {
      projetId = parentId;
      equipeId = childId;
    } else if (viewMode === 'team') {
      equipeId = parentId;
      projetId = childId;
    } else {
      equipeId = parentId.split('_')[0];
      projetId = resource.projectId || resource.id;
    }

    const rId = resource.resourceId || resource.id;
    return {
      projetId,
      equipeId,
      roleId: resource.type === 'role' ? rId : undefined,
      personneId: resource.type === 'personne' ? rId : undefined,
    };
  }

  async applyBulkCharges(
    viewMode: PlanViewMode,
    selectedCells: SelectedCell[],
    value: number,
    targetComment: string | undefined,
  ): Promise<void> {
    for (const cell of selectedCells) {
      const weekKey = formatWeekStart(cell.week);
      const target = this.resolveResourceTarget(viewMode, cell.parentId, cell.childId, cell.resource);
      await this.chargeService.createOrUpdateCharge(
        target.projetId,
        target.equipeId,
        weekKey,
        value,
        target.roleId,
        target.personneId,
        targetComment !== undefined ? targetComment : cell.resource.comments?.get(weekKey),
      );
    }
  }

  async applyProjectedCharges(
    viewMode: PlanViewMode,
    firstCell: SelectedCell,
    startWeekIdx: number,
    nbWeeks: number,
    displayedWeeks: Date[],
    resourcesCount: number,
  ): Promise<void> {
    const target = this.resolveResourceTarget(viewMode, firstCell.parentId, firstCell.childId, firstCell.resource);

    for (let i = 0; i < nbWeeks; i++) {
      const currentTargetIdx = startWeekIdx + i;
      if (currentTargetIdx >= displayedWeeks.length) break;

      const weekKey = formatWeekStart(displayedWeeks[currentTargetIdx]);
      await this.chargeService.createOrUpdateCharge(
        target.projetId,
        target.equipeId,
        weekKey,
        resourcesCount,
        target.roleId,
        target.personneId,
      );
    }
  }

  async moveSelectedCharges(
    viewMode: PlanViewMode,
    selectedCells: SelectedCell[],
    displayedWeeks: Date[],
    moveGhostOffset: number,
  ): Promise<void> {
    const firstCell = selectedCells[0];
    const target = this.resolveResourceTarget(viewMode, firstCell.parentId, firstCell.childId, firstCell.resource);

    const moves = selectedCells
      .map((cell) => {
        const fromWeek = formatWeekStart(cell.week);
        const value = cell.resource.charges.get(fromWeek) || 0;
        const srcIdx = displayedWeeks.findIndex((w) => w.getTime() === cell.week.getTime());
        const tgtWeek = displayedWeeks[srcIdx + moveGhostOffset];
        return { fromWeek, toWeek: tgtWeek ? formatWeekStart(tgtWeek) : '', value };
      })
      .filter((m) => m.toWeek);

    await this.chargeService.bulkMoveCharges(target.projetId, target.equipeId, moves, target.roleId, target.personneId);
  }

  async updateProjectRank(rows: ParentRow[], rowsAll: ParentRow[], index: number): Promise<ParentRow[]> {
    const movedItem = rows[index];
    if (!movedItem?.originalProject) return rowsAll;

    const rankStr = calculateNewRank(rows, index, (row) => row.originalProject?.rank);
    movedItem.originalProject.rank = rankStr;

    const sortedAll = sortByRank(
      rowsAll,
      (row) => row.originalProject?.rank,
      (a, b) => a.label.localeCompare(b.label),
    );
    await this.projetService.updateProjet(movedItem.id, { rank: rankStr });
    return sortedAll;
  }

  async addAllTeamResourcesToProject(equipeId: string, projetId: string): Promise<void> {
    const teamResources = await this.teamService.getEquipeResources(equipeId);
    const existingCharges = await this.chargeService.getChargesByProject(projetId);
    const teamCharges = existingCharges.filter((c) => c.equipe_id === equipeId);

    for (const resource of teamResources) {
      const isAlreadyAdded = teamCharges.some(
        (c) =>
          (resource.type === 'role' && c.role_id === resource.id) ||
          (resource.type === 'personne' && c.personne_id === resource.id),
      );
      if (!isAlreadyAdded) {
        const roleId = resource.type === 'role' ? resource.id : undefined;
        const personneId = resource.type === 'personne' ? resource.id : undefined;
        await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, personneId);
      }
    }
  }

  async linkProjectAndAddTeamResources(projetId: string, equipeId: string): Promise<void> {
    await this.projetService.linkProjectToTeam(projetId, equipeId);
    await this.addAllTeamResourcesToProject(equipeId, projetId);
  }

  async linkBulkItems(
    viewMode: PlanViewMode,
    selectedParentRow: ParentRow,
    selectedChildRowToLink: ChildRow | null,
    selectedIdsToLink: Set<string>,
    allProjects: Projet[],
  ): Promise<string[]> {
    const errors: string[] = [];

    for (const selectedId of Array.from(selectedIdsToLink)) {
      try {
        if (viewMode === 'team') {
          await this.linkProjectAndAddTeamResources(selectedId, selectedParentRow.id);
        } else if (viewMode === 'resource') {
          if (!selectedChildRowToLink) {
            const [equipeId, type, rawResId] = selectedParentRow.id.split('_');
            await this.chargeService.createChargeWithoutDates(
              selectedId,
              equipeId,
              type === 'role' ? rawResId : undefined,
              type === 'personne' ? rawResId : undefined,
            );
          } else {
            const equipeId = selectedParentRow.id.split('_')[0];
            const [type, resId] = selectedChildRowToLink.id.split('_');
            await this.chargeService.createChargeWithoutDates(
              selectedId,
              equipeId,
              type === 'role' ? resId : undefined,
              type === 'personne' ? resId : undefined,
            );
          }
        }
      } catch (error) {
        console.error('Error linking item:', error);
        const proj = allProjects.find((p) => p.id === selectedId);
        errors.push(proj?.nom_projet || selectedId);
      }
    }

    return errors;
  }

  async linkNewlyCreatedProject(
    viewMode: PlanViewMode,
    newProjectId: string,
    selectedParentRow: ParentRow,
    selectedChildRowToLink: ChildRow | null,
  ): Promise<void> {
    if (viewMode === 'team') {
      await this.linkProjectAndAddTeamResources(newProjectId, selectedParentRow.id);
    } else if (viewMode === 'resource') {
      if (!selectedChildRowToLink) {
        const [equipeId, type, rawResId] = selectedParentRow.id.split('_');
        await this.chargeService.createChargeWithoutDates(
          newProjectId,
          equipeId,
          type === 'role' ? rawResId : undefined,
          type === 'personne' ? rawResId : undefined,
        );
      } else {
        const equipeId = selectedParentRow.id.split('_')[0];
        const [type, resId] = selectedChildRowToLink.id.split('_');
        await this.chargeService.createChargeWithoutDates(
          newProjectId,
          equipeId,
          type === 'role' ? resId : undefined,
          type === 'personne' ? resId : undefined,
        );
      }
    }
  }

  async loadAvailableResourcesForProjectTeam(
    viewMode: PlanViewMode,
    parent: ParentRow,
    child: ChildRow,
  ): Promise<{ roles: Role[]; personnes: Personne[] }> {
    const projetId = viewMode === 'project' ? parent.id : child.id;
    const equipeId = viewMode === 'project' ? child.id : parent.id;
    const [roles, personnes] = await Promise.all([
      this.chargeService.getAvailableRolesForProjectTeam(projetId, equipeId),
      this.chargeService.getAvailablePersonnesForProjectTeam(projetId, equipeId),
    ]);
    return { roles, personnes };
  }

  async addResourceToCharge(
    viewMode: PlanViewMode,
    parent: ParentRow,
    child: ChildRow,
    resourceType: 'role' | 'personne',
    resourceId: string,
  ): Promise<void> {
    const projetId = viewMode === 'project' ? parent.id : child.id;
    const equipeId = viewMode === 'project' ? child.id : parent.id;
    await this.chargeService.createChargeWithoutDates(
      projetId,
      equipeId,
      resourceType === 'role' ? resourceId : undefined,
      resourceType === 'personne' ? resourceId : undefined,
    );
  }

  async removeResourceCharges(
    viewMode: PlanViewMode,
    resource: ResourceRow,
    child: ChildRow,
    parent: ParentRow,
  ): Promise<void> {
    const target = this.resolveResourceTarget(viewMode, parent.id, child.id, resource);
    await this.chargeService.deleteChargesForResource(
      target.projetId,
      target.equipeId,
      target.roleId,
      target.personneId,
    );
  }

  async removeChildAssociation(viewMode: PlanViewMode, child: ChildRow, parent: ParentRow): Promise<void> {
    if (viewMode === 'resource') {
      const [type, resId] = child.id.split('_');
      const roleId = type === 'role' ? resId : undefined;
      const personneId = type === 'personne' ? resId : undefined;
      const equipeId = parent.id.split('_')[0];

      await this.chargeService.deleteChargesForResource(undefined, equipeId, roleId, personneId);
      if (type === 'role') {
        await this.teamService.removeRoleFromEquipe(resId, equipeId);
      } else {
        await this.teamService.removePersonneFromEquipe(resId);
      }
    } else {
      const projetId = viewMode === 'project' ? parent.id : child.id;
      const equipeId = viewMode === 'project' ? child.id : parent.id;
      await this.chargeService.deleteChargesForProjectTeam(projetId, equipeId);
      await this.projetService.unlinkProjectFromTeam(projetId, equipeId);
    }
  }

  runDriverTutorial(mode: 'full' | 'vue-only'): void {
    const steps: {
      element: string;
      popover: {
        title: string;
        description: string;
        side: 'bottom' | 'right';
        align: 'start' | 'end';
        showButtons: ('next' | 'previous' | 'close')[];
      };
    }[] = [];

    if (mode === 'full') {
      steps.push({
        element: '[data-tour="actions-menu"]',
        popover: {
          title: 'Nouveau menu "Actions"',
          description:
            'On a regroupé les options d’affichage et d’export dans ce nouveau menu pour libérer de l’espace.',
          side: 'bottom',
          align: 'end',
          showButtons: ['next', 'previous', 'close'],
        },
      });
    }

    steps.push({
      element: '[data-tour="view-mode-selector"]',
      popover: {
        title: 'Choix de la Vue',
        description:
          'Le choix de la vue (Par Projet, Par Équipe, Par Ressources) a été déplacé ici. Cliquez sur cette icône pour changer de vue.',
        side: 'bottom',
        align: 'start',
        showButtons: ['next', 'previous', 'close'],
      },
    });

    if (mode === 'full') {
      if (document.querySelector('[data-tour="line-menu"]')) {
        steps.push({
          element: '[data-tour="line-menu"]',
          popover: {
            title: 'Options de ligne',
            description: 'Retrouvez ici les actions spécifiques à cette ligne (ajout de ressource, suppression, etc.).',
            side: 'right',
            align: 'start',
            showButtons: ['next', 'previous', 'close'],
          },
        });
      }

      if (document.querySelector('[data-tour="drag-handle"]')) {
        steps.push({
          element: '[data-tour="drag-handle"]',
          popover: {
            title: 'Réorganisation',
            description:
              'Désormais, uniquement dans la Vue "Par Projets", les lignes déplaçables sont indiquées avec la poignée cdkdraghandle.',
            side: 'right',
            align: 'start',
            showButtons: ['next', 'previous', 'close'],
          },
        });
      }

      steps.push({
        element: '.header-search-bar',
        popover: {
          title: 'Recherche globale',
          description: 'Vous pouvez filtrer les lignes projets visibles via une chaîne de caractères.',
          side: 'bottom',
          align: 'start',
          showButtons: ['next', 'previous', 'close'],
        },
      });
    }

    const driverObj = driver({
      showProgress: steps.length > 1,
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.75)',
      popoverClass: 'premium-driver-popover',
      steps,
      onDestroyed: () => {
        if (mode === 'full') {
          localStorage.setItem('tutorial-actions-menu-v1', 'true');
          localStorage.setItem('tutorial-view-mode-selector-v1', 'true');
        } else {
          localStorage.setItem('tutorial-view-mode-selector-v1', 'true');
        }
      },
    });

    driverObj.drive();
  }

  exportToExcel(rowsAll: ParentRow[], displayedWeeks: Date[], viewMode: PlanViewMode): void {
    const weekHeaders = displayedWeeks.map((w) => {
      const d = w.getDate().toString().padStart(2, '0');
      const m = (w.getMonth() + 1).toString().padStart(2, '0');
      return `${d}/${m}/${w.getFullYear()}`;
    });

    const headers = ['Projet', 'Code Projet', 'Réf Externe', 'Équipe', 'Ressource', 'Type', ...weekHeaders];
    const dataRows: (string | number)[][] = [];

    for (const parent of rowsAll) {
      for (const child of parent.children) {
        for (const resource of child.resources) {
          const meta =
            viewMode === 'project'
              ? [parent.label, parent.code || '', parent.reference_externe || '', child.label, resource.label]
              : viewMode === 'team'
                ? [child.label, child.code || '', child.reference_externe || '', parent.label, resource.label]
                : viewMode === 'service'
                  ? [
                      resource.label,
                      resource.code || '',
                      resource.reference_externe || '',
                      parent.label,
                      'Consolidé Service',
                    ]
                  : [resource.label, resource.code || '', resource.reference_externe || '', parent.label, child.label];

          const weekValues = displayedWeeks.map((w) => {
            const val = resource.charges.get(formatWeekStart(w));
            return val === 0 || val === undefined ? '' : val;
          });

          dataRows.push([...meta, resource.type, ...weekValues]);
        }
      }
    }

    dataRows.sort((a, b) => {
      const pa = (a[0] as string).localeCompare(b[0] as string);
      if (pa !== 0) return pa;
      const ea = (a[3] as string).localeCompare(b[3] as string);
      if (ea !== 0) return ea;
      return (a[4] as string).localeCompare(b[4] as string);
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = [
      { wch: 30 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 24 },
      { wch: 10 },
      ...weekHeaders.map(() => ({ wch: 12 })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planification');

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    XLSX.writeFile(wb, `planification_${dateStr}.xlsx`);
  }
}
