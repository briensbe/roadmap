/**
 * @file plan-projection.engine.ts
 * @description Moteur de calcul et de projection métier pur (Deep Module sans dépendance Angular ni DOM).
 *
 * Responsabilités :
 * - Construire l'arbre hiérarchique (`buildPlanTree`) selon les 4 modes de vue (`project`, `team`, `resource`, `service`)
 *   ainsi que la projection à plat (`buildFlatList`).
 * - Calculer l'utilisation, la disponibilité nette (`capacité - charge`), les cellules pré-calculées
 *   et les métriques hebdomadaires agrégées (`calculateTreeMetrics`, `calculateFilteredTreeMetrics`).
 * - Agréger les jours planifiés (RAF, année, tout) et résoudre les chiffres budgétaires par service, équipe et projet.
 * - Appliquer le filtrage multicritères hiérarchique (`applyPlanFilters`).
 */
import { getISOWeekYear } from 'date-fns';
import { Charge } from '../../models/types';
import { Chiffre } from '../../models/chiffres.type';
import { textContains } from '../../utils/text.utils';
import { sortByRank } from '../../utils/lexorank.utils';
import {
  PlanViewMode,
  ChiffreCategory,
  CapacityYearSelection,
  PlannedDaysPeriod,
  SizeFilterOperator,
  ResourceRow,
  ChildRow,
  ParentRow,
  FlatRow,
  PlanRawDataset,
  PlanFilterCriteria,
} from './plan-view.models';

export function formatWeekStart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalDate(d: Date): string {
  return formatWeekStart(d);
}

export function cleanJiraRef(ref: string | null | undefined): string {
  if (!ref) return '';
  const match = ref.match(/(SUIVI-\d+)/i);
  return match ? match[1].toUpperCase() : ref.trim();
}

/**
 * Résout strictement le service_id d'un profil (role) ou d'une personne,
 * sans aucun fallback sur Equipe.service_id.
 */
export function getResourceServiceId(
  dataset: Pick<PlanRawDataset, 'availablePersonnes' | 'allRoleAttachments' | 'availableRoles'>,
  type: 'role' | 'personne',
  resourceId: string,
  teamId?: string,
): string | null {
  if (!resourceId) return null;
  if (type === 'personne') {
    return dataset.availablePersonnes.find((p) => p.id === resourceId)?.service_id ?? null;
  }
  if (teamId) {
    const teamAtt = dataset.allRoleAttachments.find((a) => a.role_id === resourceId && a.equipe_id === teamId && a.service_id != null);
    if (teamAtt?.service_id) return teamAtt.service_id;
  }
  const anyAtt = dataset.allRoleAttachments.find((a) => a.role_id === resourceId && a.service_id != null);
  if (anyAtt?.service_id) return anyAtt.service_id;
  return dataset.availableRoles.find((r) => r.id === resourceId)?.service_id ?? null;
}

export function getServiceResourceKeys(
  dataset: Pick<PlanRawDataset, 'allRoleAttachments' | 'availablePersonnes' | 'availableRoles' | 'allCapacities'>,
  serviceId: string,
  activeEquipeIds: string[],
  activeResourceIds: string[],
): Set<string> {
  const keys = new Set<string>();
  const passesFilters = (teamId: string | null | undefined, type: 'role' | 'personne', rId: string): boolean => {
    if (!teamId || !rId) return false;
    if (activeEquipeIds.length > 0 && !activeEquipeIds.includes(teamId)) return false;
    if (activeResourceIds.length > 0 && !activeResourceIds.includes(`${type}:${rId}`)) return false;
    return getResourceServiceId(dataset, type, rId, teamId) === serviceId;
  };

  for (const att of dataset.allRoleAttachments) {
    if (passesFilters(att.equipe_id, 'role', att.role_id)) keys.add(`${att.equipe_id}_role_${att.role_id}`);
  }
  for (const p of dataset.availablePersonnes) {
    if (passesFilters(p.equipe_id, 'personne', p.id!)) keys.add(`${p.equipe_id}_personne_${p.id}`);
  }
  for (const cap of dataset.allCapacities) {
    const rType: 'role' | 'personne' = cap.role_id ? 'role' : 'personne';
    const rId = cap.role_id || cap.personne_id || '';
    if (passesFilters(cap.equipe_id, rType, rId)) keys.add(`${cap.equipe_id}_${rType}_${rId}`);
  }
  return keys;
}

export function shouldShowResourceByWeekFilters(resource: ResourceRow, weekFilters: number[], displayedWeeks: Date[]): boolean {
  if (weekFilters.length === 0) return true;
  for (const weekIndex of weekFilters) {
    const week = displayedWeeks[weekIndex];
    if (!week) continue;
    if ((resource.charges.get(week.toISOString().split('T')[0]) || 0) === 0) return false;
  }
  return true;
}

function resolveChargeActor(dataset: Pick<PlanRawDataset, 'availableRoles' | 'availablePersonnes'>, charge: Charge, fallbackDays = 0) {
  if (charge.role_id) {
    const role = dataset.availableRoles.find((r) => r.id === charge.role_id);
    return {
      id: charge.role_id,
      key: `role_${charge.role_id}`,
      label: role ? role.nom : 'Unknown Role',
      type: 'role' as const,
      jours: role?.jours_par_semaine || fallbackDays,
      color: role?.color,
    };
  }
  if (charge.personne_id) {
    const p = dataset.availablePersonnes.find((pers) => pers.id === charge.personne_id);
    return {
      id: charge.personne_id,
      key: `personne_${charge.personne_id}`,
      label: p ? `${p.prenom} ${p.nom}` : 'Unknown Person',
      type: 'personne' as const,
      jours: p?.jours_par_semaine || fallbackDays,
      color: p?.color,
    };
  }
  return null;
}

function accumulateGroupResources(
  dataset: PlanRawDataset,
  charges: Charge[],
  uniquePrefix: string,
  projectId: string | undefined,
  childTotals: Map<string, number>,
  parentTotals: Map<string, number>,
  weekFilters: number[],
  displayedWeeks: Date[],
): ResourceRow[] {
  const resourceMap = new Map<string, ResourceRow>();
  for (const charge of charges) {
    const actor = resolveChargeActor(dataset, charge, 0);
    if (!actor) continue;
    if (!resourceMap.has(actor.key)) {
      resourceMap.set(actor.key, {
        id: actor.id,
        uniqueId: `${uniquePrefix}_${actor.id}_${actor.type}`,
        label: actor.label,
        type: actor.type,
        jours_par_semaine: actor.jours,
        charges: new Map<string, number>(),
        comments: new Map<string, string>(),
        color: actor.color,
        resourceId: actor.id,
        projectId,
      });
    }
    const resource = resourceMap.get(actor.key)!;
    if (charge.semaine_debut) {
      const weekKey = charge.semaine_debut.split('T')[0];
      resource.charges.set(weekKey, (resource.charges.get(weekKey) || 0) + charge.unite_ressource);
      if (charge.comment) resource.comments?.set(weekKey, charge.comment);
      childTotals.set(weekKey, (childTotals.get(weekKey) || 0) + charge.unite_ressource);
      parentTotals.set(weekKey, (parentTotals.get(weekKey) || 0) + charge.unite_ressource);
    }
  }
  return Array.from(resourceMap.values())
    .filter((r) => shouldShowResourceByWeekFilters(r, weekFilters, displayedWeeks))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildPlanTree(
  dataset: PlanRawDataset,
  viewMode: PlanViewMode,
  manualStates: Map<string, boolean>,
  isDefaultExpanded: boolean,
  weekFilters: number[],
  displayedWeeks: Date[],
  activeEquipeIds: string[],
  activeResourceIds: string[],
): ParentRow[] {
  const rows: ParentRow[] = [];

  if (viewMode === 'project') {
    const sortedProjects = sortByRank(dataset.allProjects, (p) => p.rank, (a, b) => a.nom_projet.localeCompare(b.nom_projet));
    for (const project of sortedProjects) {
      const projectCharges = dataset.allCharges.filter((c) => c.projet_id === project.id);
      const chargeTeamIds = projectCharges.map((c) => c.equipe_id).filter((id): id is string => !!id);
      const linkedTeamIds = dataset.allLinks.filter((l) => l.projet_id === project.id).map((l) => l.equipe_id);
      const involvedTeamIds = new Set([...chargeTeamIds, ...linkedTeamIds]);
      const children: ChildRow[] = [];
      const parentTotal = new Map<string, number>();

      for (const teamId of involvedTeamIds) {
        const team = dataset.allEquipes.find((e) => e.id === teamId);
        const teamCharges = new Map<string, number>();
        const filteredResources = accumulateGroupResources(
          dataset,
          projectCharges.filter((c) => c.equipe_id === teamId),
          `${project.id}_${teamId}`,
          project.id,
          teamCharges,
          parentTotal,
          weekFilters,
          displayedWeeks,
        );
        children.push({
          id: teamId,
          label: team ? team.nom : 'No Team',
          code: team?.code,
          color: team?.color,
          expanded: manualStates.get(`${project.id}_${teamId}`) ?? isDefaultExpanded,
          resources: filteredResources,
          charges: teamCharges,
        });
      }
      children.sort((a, b) => a.label.localeCompare(b.label));
      rows.push({
        id: project.id!,
        label: project.nom_projet,
        code: project.code_projet,
        reference_externe: project.reference_externe,
        color: project.color,
        expanded: manualStates.get(project.id!) ?? isDefaultExpanded,
        children,
        totalCharges: parentTotal,
        originalProject: project,
      });
    }
  } else if (viewMode === 'team') {
    const sortedTeams = [...dataset.allEquipes].sort((a, b) => a.nom.localeCompare(b.nom));
    for (const team of sortedTeams) {
      const teamCharges = dataset.allCharges.filter((c) => c.equipe_id === team.id);
      const chargeProjectIds = teamCharges.map((c) => c.projet_id).filter((id): id is string => !!id);
      const linkedProjectIds = dataset.allLinks.filter((l) => l.equipe_id === team.id).map((l) => l.projet_id);
      const involvedProjectIds = new Set([...chargeProjectIds, ...linkedProjectIds]);
      const children: ChildRow[] = [];
      const parentTotal = new Map<string, number>();
      const sortedInvolvedProjects = sortByRank(
        dataset.allProjects.filter((p) => involvedProjectIds.has(p.id!)),
        (p) => p.rank,
        (a, b) => a.nom_projet.localeCompare(b.nom_projet),
      );

      for (const project of sortedInvolvedProjects) {
        const projectId = project.id!;
        const projectCharges = new Map<string, number>();
        const filteredResources = accumulateGroupResources(
          dataset,
          teamCharges.filter((c) => c.projet_id === projectId),
          `${team.id}_${projectId}`,
          projectId,
          projectCharges,
          parentTotal,
          weekFilters,
          displayedWeeks,
        );
        children.push({
          id: projectId,
          label: project.nom_projet,
          code: project.code_projet,
          reference_externe: project.reference_externe,
          color: project.color,
          expanded: manualStates.get(`${team.id}_${projectId}`) ?? isDefaultExpanded,
          resources: filteredResources,
          charges: projectCharges,
          originalProject: project,
        });
      }
      rows.push({
        id: team.id!,
        label: team.nom,
        code: team.code,
        color: team.color,
        expanded: manualStates.get(team.id!) ?? isDefaultExpanded,
        children,
        totalCharges: parentTotal,
      });
    }
  } else if (viewMode === 'resource') {
    const sortedTeams = [...dataset.allEquipes].sort((a, b) => a.nom.localeCompare(b.nom));
    for (const team of sortedTeams) {
      const teamCharges = dataset.allCharges.filter((c) => c.equipe_id === team.id);
      const resourceMap = new Map<
        string,
        {
          label: string;
          type: 'role' | 'personne';
          jours_par_semaine: number;
          color?: string;
          charges: Map<string, number>;
          comments: Map<string, string>;
          projectDetailedMap: Map<string, ResourceRow>;
        }
      >();

      for (const att of dataset.allRoleAttachments.filter((a) => a.equipe_id === team.id)) {
        const role = dataset.availableRoles.find((r) => r.id === att.role_id);
        if (role) {
          resourceMap.set(`role_${role.id}`, {
            label: role.nom,
            type: 'role',
            jours_par_semaine: role.jours_par_semaine,
            color: role.color,
            charges: new Map(),
            comments: new Map(),
            projectDetailedMap: new Map(),
          });
        }
      }
      for (const p of dataset.availablePersonnes.filter((pers) => pers.equipe_id === team.id)) {
        resourceMap.set(`personne_${p.id}`, {
          label: `${p.prenom} ${p.nom}`,
          type: 'personne',
          jours_par_semaine: p.jours_par_semaine,
          color: p.color,
          charges: new Map(),
          comments: new Map(),
          projectDetailedMap: new Map(),
        });
      }

      for (const charge of teamCharges) {
        const actor = resolveChargeActor(dataset, charge, 0);
        if (!actor) continue;
        if (!resourceMap.has(actor.key)) {
          resourceMap.set(actor.key, {
            label: actor.label,
            type: actor.type,
            jours_par_semaine: actor.jours,
            color: actor.color,
            charges: new Map(),
            comments: new Map(),
            projectDetailedMap: new Map(),
          });
        }
        const res = resourceMap.get(actor.key)!;
        const weekKey = charge.semaine_debut?.split('T')[0];
        const pId = charge.projet_id || 'no_project';
        if (!res.projectDetailedMap.has(pId)) {
          const project = dataset.allProjects.find((p) => p.id === pId);
          res.projectDetailedMap.set(pId, {
            id: pId,
            uniqueId: `${team.id}_${actor.key}_${pId}`,
            label: project ? project.nom_projet : 'Sans projet',
            code: project?.code_projet,
            reference_externe: project?.reference_externe,
            type: res.type,
            jours_par_semaine: res.jours_par_semaine,
            charges: new Map(),
            comments: new Map(),
            color: project?.color,
            resourceId: actor.id,
            projectId: pId,
          });
        }
        if (weekKey) {
          res.charges.set(weekKey, (res.charges.get(weekKey) || 0) + charge.unite_ressource);
          if (charge.comment) res.comments.set(weekKey, charge.comment);
          const detRow = res.projectDetailedMap.get(pId)!;
          detRow.charges.set(weekKey, (detRow.charges.get(weekKey) || 0) + charge.unite_ressource);
          if (charge.comment) detRow.comments?.set(weekKey, charge.comment);
        }
      }

      resourceMap.forEach((res, rKey) => {
        const projectResources = sortByRank(
          Array.from(res.projectDetailedMap.values()),
          (r) => dataset.allProjects.find((p) => p.id === r.projectId)?.rank,
          (a, b) => a.label.localeCompare(b.label),
        ).filter((r) => shouldShowResourceByWeekFilters(r, weekFilters, displayedWeeks));

        rows.push({
          id: `${team.id}_${rKey}`,
          label: `${team.nom} - ${res.label}`,
          code: team.code,
          color: team.color,
          expanded: manualStates.get(`${team.id}_${rKey}`) ?? isDefaultExpanded,
          children: [{ id: rKey, label: res.label, color: res.color, expanded: true, charges: res.charges, resources: projectResources }],
          totalCharges: res.charges,
        });
      });
    }
  } else if (viewMode === 'service') {
    const sortedServices = [...dataset.allServices].sort((a, b) => a.nom.localeCompare(b.nom));
    for (const service of sortedServices) {
      const parentTotal = new Map<string, number>();
      const projectDetailedMap = new Map<string, ResourceRow>();

      for (const charge of dataset.allCharges) {
        const actor = resolveChargeActor(dataset, charge, 5);
        if (!actor) continue;
        if (activeEquipeIds.length > 0 && (!charge.equipe_id || !activeEquipeIds.includes(charge.equipe_id))) continue;
        if (activeResourceIds.length > 0 && !activeResourceIds.includes(`${actor.type}:${actor.id}`)) continue;
        if (getResourceServiceId(dataset, actor.type, actor.id, charge.equipe_id) !== service.id) continue;

        const pId = charge.projet_id || 'no_project';
        if (!projectDetailedMap.has(pId)) {
          const project = dataset.allProjects.find((p) => p.id === pId);
          projectDetailedMap.set(pId, {
            id: pId,
            uniqueId: `service_${service.id}_${pId}`,
            label: project ? project.nom_projet : 'Sans projet',
            code: project?.code_projet,
            reference_externe: project?.reference_externe,
            type: 'role',
            jours_par_semaine: 5,
            charges: new Map<string, number>(),
            dailyCharges: new Map<string, number>(),
            comments: new Map<string, string>(),
            color: project?.color,
            resourceId: service.id,
            projectId: pId,
          });
        }
        const weekKey = charge.semaine_debut?.split('T')[0];
        if (weekKey) {
          parentTotal.set(weekKey, (parentTotal.get(weekKey) || 0) + charge.unite_ressource);
          const detRow = projectDetailedMap.get(pId)!;
          detRow.charges.set(weekKey, (detRow.charges.get(weekKey) || 0) + charge.unite_ressource);
          detRow.dailyCharges!.set(weekKey, (detRow.dailyCharges!.get(weekKey) || 0) + charge.unite_ressource * actor.jours);
          if (charge.comment) {
            const existing = detRow.comments?.get(weekKey);
            const entry = `${actor.label}: ${charge.comment}`;
            detRow.comments?.set(weekKey, existing ? `${existing} | ${entry}` : entry);
          }
        }
      }

      const filteredProjectResources = sortByRank(
        Array.from(projectDetailedMap.values()),
        (r) => dataset.allProjects.find((p) => p.id === r.projectId)?.rank,
        (a, b) => a.label.localeCompare(b.label),
      ).filter((r) => shouldShowResourceByWeekFilters(r, weekFilters, displayedWeeks));

      const isExpanded = manualStates.get(service.id!) ?? isDefaultExpanded;
      rows.push({
        id: service.id!,
        label: service.nom,
        expanded: isExpanded,
        children: [{ id: `service_children_${service.id}`, label: service.nom, expanded: isExpanded, charges: parentTotal, resources: filteredProjectResources }],
        totalCharges: parentTotal,
      });
    }
  }

  return rows;
}

export function buildFlatList(rows: ParentRow[], viewMode: PlanViewMode): FlatRow[] {
  const flatRows: FlatRow[] = [];
  const collator = new Intl.Collator('fr-FR', { numeric: true, sensitivity: 'base' });
  for (const parent of rows) {
    for (const child of parent.children) {
      for (const resource of child.resources) {
        const fullLabel =
          viewMode === 'service'
            ? `${parent.label} > ${resource.label} ${resource.code || ''} ${resource.reference_externe || ''}`.toLowerCase()
            : `${parent.label} > ${child.label} > ${resource.label} ${parent.code || ''} ${parent.reference_externe || ''} ${child.code || ''} ${child.reference_externe || ''}`.toLowerCase();
        flatRows.push({ uniqueId: resource.uniqueId, fullLabel, resource, child, parent });
      }
    }
  }
  flatRows.sort((a, b) => collator.compare(a.fullLabel, b.fullLabel));
  return flatRows;
}

export function calculateUsageMap(dataset: Pick<PlanRawDataset, 'allCharges' | 'usageMap'>): void {
  dataset.usageMap.clear();
  for (const charge of dataset.allCharges) {
    if (!charge.semaine_debut || !charge.equipe_id) continue;
    const weekKey = charge.semaine_debut.split('T')[0];
    const resourceKey = charge.role_id ? `role_${charge.role_id}` : charge.personne_id ? `personne_${charge.personne_id}` : null;
    if (!resourceKey) continue;
    const mapKey = `${charge.equipe_id}_${resourceKey}_${weekKey}`;
    dataset.usageMap.set(mapKey, (dataset.usageMap.get(mapKey) || 0) + charge.unite_ressource);
  }
}

export function getAvailability(
  dataset: Pick<PlanRawDataset, 'usageMap' | 'capacityIndex'>,
  resource: ResourceRow,
  week: Date,
  teamId: string,
): number {
  const weekKey = formatWeekStart(week);
  const rId = resource.resourceId || resource.id;
  const mapKey = `${teamId}_${resource.type}_${rId}_${weekKey}`;
  return (dataset.capacityIndex.get(mapKey) || 0) - (dataset.usageMap.get(mapKey) || 0);
}

export function shouldShowAvailability(
  dataset: Pick<PlanRawDataset, 'usageMap' | 'capacityIndex'>,
  showAvailabilityFlag: boolean,
  resource: ResourceRow,
  week: Date,
  teamId: string,
): boolean {
  const weekKey = formatWeekStart(week);
  if ((resource.charges.get(weekKey) || 0) > 0) return true;
  if (!showAvailabilityFlag) return false;
  if (getAvailability(dataset, resource, week, teamId) !== 0) return true;
  const rId = resource.resourceId || resource.id;
  return dataset.capacityIndex.has(`${teamId}_${resource.type}_${rId}_${weekKey}`);
}

export function precalculateResource(
  dataset: Pick<PlanRawDataset, 'allCapacities' | 'availablePersonnes' | 'usageMap' | 'capacityIndex'>,
  viewMode: PlanViewMode,
  displayedWeeks: Date[],
  resource: ResourceRow,
  teamId: string,
): void {
  resource.cellData = [];
  if (viewMode === 'service') {
    for (const week of displayedWeeks) {
      const weekKey = formatWeekStart(week);
      resource.cellData.push({
        value: resource.charges.get(weekKey) || 0,
        availability: 0,
        showAvailability: false,
        isPositive: false,
        isZero: false,
        isNegative: false,
        hasCapRecord: false,
        comment: resource.comments?.get(weekKey) || null,
      });
    }
    return;
  }

  for (const week of displayedWeeks) {
    const weekKey = formatWeekStart(week);
    const value = resource.charges.get(weekKey) || 0;
    const availability = getAvailability(dataset, resource, week, teamId);
    const rId = resource.resourceId || resource.id;
    const hasCapRecord = dataset.allCapacities.some(
      (c) =>
        c.equipe_id === teamId &&
        c.semaine_debut.startsWith(weekKey) &&
        (resource.type === 'role' ? c.role_id === rId : c.personne_id === rId),
    );
    const isRelevant =
      resource.type === 'personne'
        ? (dataset.availablePersonnes.find((p) => p.id === rId)?.equipe_id === teamId)
        : true;

    resource.cellData.push({
      value,
      availability,
      showAvailability: isRelevant,
      isPositive: availability > 0,
      isZero: availability === 0,
      isNegative: availability < 0,
      hasCapRecord,
      comment: resource.comments?.get(weekKey) || null,
    });
  }
}

export function precalculateAllResources(
  dataset: Pick<PlanRawDataset, 'allCapacities' | 'availablePersonnes' | 'usageMap' | 'capacityIndex'>,
  rowsAll: ParentRow[],
  viewMode: PlanViewMode,
  displayedWeeks: Date[],
): void {
  for (const parent of rowsAll) {
    const teamIdFromParent = viewMode === 'resource' ? parent.id.split('_')[0] : parent.id;
    for (const child of parent.children) {
      const teamId = viewMode === 'project' ? child.id : teamIdFromParent;
      for (const resource of child.resources) {
        precalculateResource(dataset, viewMode, displayedWeeks, resource, teamId);
      }
    }
  }
}

function computeParentAndChildMetrics(
  dataset: Pick<PlanRawDataset, 'allRoleAttachments' | 'availablePersonnes' | 'availableRoles' | 'allCapacities' | 'capacityIndex'>,
  rows: ParentRow[],
  viewMode: PlanViewMode,
  displayedWeeks: Date[],
  activeEquipeIds: string[],
  activeResourceIds: string[],
  initResourceMetrics: boolean,
): void {
  for (const parent of rows) {
    if (initResourceMetrics || !parent.metrics) parent.metrics = new Map();
    const teamIdFromParent = viewMode === 'resource' ? parent.id.split('_')[0] : parent.id;
    const serviceResourceKeys = viewMode === 'service' ? getServiceResourceKeys(dataset, parent.id, activeEquipeIds, activeResourceIds) : null;

    if (initResourceMetrics) {
      for (const child of parent.children) {
        child.metrics = new Map();
        for (const res of child.resources) {
          res.metrics = new Map();
          for (const week of displayedWeeks) {
            const weekKey = formatWeekStart(week);
            res.metrics.set(weekKey, { total: res.charges.get(weekKey) || 0 });
          }
        }
      }
    }

    for (const week of displayedWeeks) {
      const weekKey = formatWeekStart(week);
      let total = 0;
      let totalCapacity = 0;

      for (const child of parent.children) {
        let childTotal = 0;
        for (const res of child.resources) {
          childTotal += res.metrics?.get(weekKey)?.total || 0;
        }
        child.metrics?.set(weekKey, { total: childTotal });
        if (!initResourceMetrics && (viewMode === 'resource' || viewMode === 'service')) {
          total = parent.totalCharges?.get(weekKey) || 0;
        } else {
          total += childTotal;
        }
      }

      if (viewMode === 'resource') {
        const parts = parent.id.split('_');
        totalCapacity = dataset.capacityIndex.get(`${teamIdFromParent}_${parts[1]}_${parts.slice(2).join('_')}_${weekKey}`) || 0;
      } else if (viewMode === 'service' && serviceResourceKeys) {
        total = parent.totalCharges?.get(weekKey) || 0;
        for (const resKey of serviceResourceKeys) {
          totalCapacity += dataset.capacityIndex.get(`${resKey}_${weekKey}`) || 0;
        }
      }

      const availability = totalCapacity - total;
      const status = totalCapacity > 0 || total > 0 ? (availability > 0 ? 'positive' : availability === 0 ? 'zero' : 'negative') : 'none';
      parent.metrics.set(weekKey, { total, capacity: totalCapacity, availability, status });
    }
  }
}

export function calculateTreeMetrics(
  dataset: Pick<PlanRawDataset, 'allRoleAttachments' | 'availablePersonnes' | 'availableRoles' | 'allCapacities' | 'capacityIndex'>,
  rowsAll: ParentRow[],
  viewMode: PlanViewMode,
  displayedWeeks: Date[],
  activeEquipeIds: string[],
  activeResourceIds: string[],
): void {
  computeParentAndChildMetrics(dataset, rowsAll, viewMode, displayedWeeks, activeEquipeIds, activeResourceIds, true);
}

export function calculateFilteredTreeMetrics(
  dataset: Pick<PlanRawDataset, 'allRoleAttachments' | 'availablePersonnes' | 'availableRoles' | 'allCapacities' | 'capacityIndex'>,
  rows: ParentRow[],
  viewMode: PlanViewMode,
  displayedWeeks: Date[],
  activeEquipeIds: string[],
  activeResourceIds: string[],
): void {
  computeParentAndChildMetrics(dataset, rows, viewMode, displayedWeeks, activeEquipeIds, activeResourceIds, false);
}

export function getPlannedDaysForResource(resource: ResourceRow, period: PlannedDaysPeriod, todayWeekStart: Date): number {
  let total = 0;
  const todayWeekStartStr = formatLocalDate(todayWeekStart);
  const sourceMap = resource.dailyCharges ?? resource.charges;
  const useDirectDays = !!resource.dailyCharges;

  sourceMap.forEach((val, weekStr) => {
    let match: boolean;
    if (period === 'today') match = weekStr >= todayWeekStartStr;
    else if (period === 'all') match = true;
    else {
      const [y, m, d] = weekStr.split('-').map(Number);
      match = getISOWeekYear(new Date(y, m - 1, d)).toString() === period;
    }
    if (match) total += useDirectDays ? val || 0 : (val || 0) * (resource.jours_par_semaine || 5);
  });
  return total;
}

export function getPlannedDaysForChildInTeam(child: ChildRow, period: PlannedDaysPeriod, todayWeekStart: Date): number {
  let total = 0;
  for (const res of child.resources) total += getPlannedDaysForResource(res, period, todayWeekStart);
  return total;
}

export function getPlannedDaysForProjectParent(
  parent: ParentRow,
  period: PlannedDaysPeriod,
  filterEquipeIds: string[],
  todayWeekStart: Date,
): number {
  let total = 0;
  for (const teamChild of parent.children) {
    if (filterEquipeIds.length > 0 && !filterEquipeIds.includes(teamChild.id)) continue;
    for (const res of teamChild.resources) total += getPlannedDaysForResource(res, period, todayWeekStart);
  }
  return total;
}

export function getResourceTotalPlannedDays(
  resource: ResourceRow,
  yearSel: CapacityYearSelection,
  selectedStartDate: Date | null,
  todayWeekStart: Date,
): number {
  let total = 0;
  const sourceMap = resource.dailyCharges ?? resource.charges;
  const useDirectDays = !!resource.dailyCharges;
  const todayWeekStartStr = formatLocalDate(todayWeekStart);
  const selectedStartStr = selectedStartDate ? formatLocalDate(selectedStartDate) : '';

  sourceMap.forEach((val, weekStr) => {
    const dayContribution = useDirectDays ? val : val * resource.jours_par_semaine;
    if (yearSel === 'today') {
      if (weekStr >= todayWeekStartStr) total += dayContribution;
    } else if (yearSel === 'custom' && selectedStartDate) {
      if (weekStr >= selectedStartStr) total += dayContribution;
    } else {
      const [y, m, d] = weekStr.split('-').map(Number);
      const isoYear = getISOWeekYear(new Date(y, m - 1, d)).toString();
      if (yearSel === 'all' || isoYear === yearSel) total += dayContribution;
    }
  });
  return total;
}

function readChiffreCategory(chiffre: Chiffre, mode: ChiffreCategory): number | null {
  if (mode === 'restant') return (chiffre.previsionnel ?? 0) - (chiffre.consomme ?? 0);
  const value = chiffre[mode];
  return value !== undefined ? value : null;
}

export function getChiffreValueForServiceProject(
  allChiffres: Chiffre[],
  serviceId: string,
  projectId: string,
  mode: ChiffreCategory,
): number | null {
  if (!serviceId || !projectId) return null;
  const chiffre = allChiffres.find((c) => c.id_projet === projectId && c.id_service === serviceId);
  return chiffre ? readChiffreCategory(chiffre, mode) : null;
}

export function getChiffreValueForMode(
  dataset: Pick<PlanRawDataset, 'availablePersonnes' | 'allRoleAttachments' | 'allEquipes' | 'allChiffres'>,
  teamId: string,
  projectId: string,
  resourceId: string | undefined,
  resourceType: 'role' | 'personne' | undefined,
  mode: ChiffreCategory,
): number | null {
  let idService: string | null = null;
  if (resourceType === 'personne' && resourceId) {
    idService = dataset.availablePersonnes.find((p) => p.id === resourceId)?.service_id ?? null;
  } else if (resourceType === 'role' && resourceId) {
    idService = dataset.allRoleAttachments.find((a) => a.role_id === resourceId && a.equipe_id === teamId)?.service_id ?? null;
  }
  if (idService === null && !resourceId) {
    idService = dataset.allEquipes.find((e) => e.id === teamId)?.service_id ?? null;
  }
  if (idService === null || !projectId) return null;
  return getChiffreValueForServiceProject(dataset.allChiffres, idService, projectId, mode);
}

function sumChiffresForTeamIds(
  dataset: Pick<PlanRawDataset, 'allEquipes' | 'allRoleAttachments' | 'availablePersonnes' | 'allChiffres'>,
  teamIds: string[],
  projectId: string,
  category: ChiffreCategory,
): number | null {
  const serviceIds = new Set<string>();
  for (const teamId of teamIds) {
    const team = dataset.allEquipes.find((e) => e.id === teamId);
    if (team?.service_id) serviceIds.add(team.service_id);
    for (const att of dataset.allRoleAttachments) {
      if (att.equipe_id === teamId && att.service_id) serviceIds.add(att.service_id);
    }
    for (const pers of dataset.availablePersonnes) {
      if (pers.equipe_id === teamId && pers.service_id) serviceIds.add(pers.service_id);
    }
  }
  if (serviceIds.size === 0) return null;
  let total = 0;
  let found = false;
  for (const sId of serviceIds) {
    const val = getChiffreValueForServiceProject(dataset.allChiffres, sId, projectId, category);
    if (val !== null) {
      found = true;
      total += val;
    }
  }
  return found ? total : null;
}

export function getChiffreValueForTeamProject(
  dataset: Pick<PlanRawDataset, 'allEquipes' | 'allRoleAttachments' | 'availablePersonnes' | 'allChiffres'>,
  teamId: string,
  projectId: string,
  category: ChiffreCategory,
): number | null {
  return sumChiffresForTeamIds(dataset, [teamId], projectId, category);
}

export function getChiffreValueForProjectParent(
  dataset: Pick<PlanRawDataset, 'allEquipes' | 'allRoleAttachments' | 'availablePersonnes' | 'allChiffres'>,
  parent: ParentRow,
  filterEquipeIds: string[],
  category: ChiffreCategory,
): number | null {
  const teamIds = parent.children
    .map((c) => c.id)
    .filter((id) => filterEquipeIds.length === 0 || filterEquipeIds.includes(id));
  return sumChiffresForTeamIds(dataset, teamIds, parent.id, category);
}

export function checkSizeMatch(val: number | null, operator: SizeFilterOperator, targetValue: number): boolean {
  if (val === null) return false;
  return operator === 'gte' ? val >= targetValue : val <= targetValue;
}

function hasChargesInPeriod(chargesMap: Map<string, number> | undefined, startDate: string, endDate: string): boolean {
  if (!chargesMap || chargesMap.size === 0) return false;
  for (const [weekKey, val] of chargesMap.entries()) {
    if (val > 0 && weekKey >= startDate && weekKey <= endDate) return true;
  }
  return false;
}

export function applyPlanFilters(
  dataset: PlanRawDataset,
  rowsAll: ParentRow[],
  criteria: PlanFilterCriteria,
  todayWeekStart: Date,
): ParentRow[] {
  const search = criteria.globalSearch.trim();
  const periodStart = criteria.effectivePeriodStart;
  const periodEnd = criteria.effectivePeriodEnd;
  const periodEnabled = criteria.filterPeriodEnabled;
  const sizeEnabled = criteria.filterSizeEnabled && criteria.filterSizeValue !== null;
  const sizeCriterion = criteria.filterSizeCriterion;
  const sizeOperator = criteria.filterSizeOperator;
  const sizeValue = criteria.filterSizeValue ?? 0;

  const hasSpecificFilter =
    criteria.filterEquipeIds.length > 0 ||
    criteria.filterProjetIds.length > 0 ||
    criteria.filterResourceIds.length > 0 ||
    criteria.filterStatusIds.length > 0 ||
    periodEnabled ||
    sizeEnabled;

  if (!hasSpecificFilter && !search) return [...rowsAll];

  const matchingProjetIds = new Set<string>();
  const matchingRoleIds = new Set<string>();
  const matchingPersonneIds = new Set<string>();

  if (search) {
    for (const p of dataset.allProjects) {
      if (textContains(p.nom_projet, search) || textContains(p.code_projet, search) || textContains(p.reference_externe, search)) {
        matchingProjetIds.add(p.id!);
      }
    }
    for (const r of dataset.availableRoles) {
      if (textContains(r.nom, search)) matchingRoleIds.add(r.id!);
    }
    for (const p of dataset.availablePersonnes) {
      if (textContains(`${p.prenom} ${p.nom}`, search)) matchingPersonneIds.add(p.id!);
    }
  }

  const resourceMatchesSearchSelf = (res: ResourceRow): boolean => {
    if (!search) return true;
    if (textContains(res.label, search) || textContains(res.reference_externe, search)) return true;
    return res.type === 'role' ? matchingRoleIds.has(res.resourceId || res.id) : matchingPersonneIds.has(res.resourceId || res.id);
  };
  const matchesRowText = (r: { label: string; code?: string; reference_externe?: string }) =>
    !search || textContains(r.label, search) || textContains(r.code, search) || textContains(r.reference_externe, search);

  const filteredParents: ParentRow[] = [];
  const viewMode = criteria.viewMode;
  const isResourceMode = viewMode === 'resource';
  const isServiceMode = viewMode === 'service';
  const isProjectLeafMode = isResourceMode || isServiceMode;

  for (const parent of rowsAll) {
    const pMatches = matchesRowText(parent);
    const parentPassesEquipe =
      !criteria.filterEquipeIds.length ||
      (viewMode === 'team' ? criteria.filterEquipeIds.includes(parent.id) : isResourceMode ? criteria.filterEquipeIds.includes(parent.id.split('_')[0]) : true);
    const parentPassesResource =
      !criteria.filterResourceIds.length ||
      !isResourceMode ||
      criteria.filterResourceIds.some((sel) => {
        const [t, id] = sel.split(':');
        return parent.id.endsWith(`${t}_${id}`);
      });
    const parentPassesProjet = !criteria.filterProjetIds.length || viewMode !== 'project' || criteria.filterProjetIds.includes(parent.id);
    const parentPassesStatut =
      !criteria.filterStatusIds.length || viewMode !== 'project' || !parent.originalProject || criteria.filterStatusIds.includes(parent.originalProject.statut);
    const parentPassesPeriod = !periodEnabled || hasChargesInPeriod(parent.totalCharges, periodStart, periodEnd);

    let parentPassesLargeProject = true;
    if (sizeEnabled && viewMode === 'project') {
      const val = sizeCriterion.startsWith('charges_')
        ? getPlannedDaysForProjectParent(parent, sizeCriterion.substring(8) as PlannedDaysPeriod, criteria.filterEquipeIds, todayWeekStart)
        : getChiffreValueForProjectParent(dataset, parent, criteria.filterEquipeIds, sizeCriterion.substring(8) as ChiffreCategory);
      parentPassesLargeProject = checkSizeMatch(val, sizeOperator, sizeValue);
    }

    if (!parentPassesPeriod || !parentPassesLargeProject) continue;
    if (!pMatches && !parentPassesEquipe && !parentPassesResource && !parentPassesProjet && !parentPassesStatut) {
      if (viewMode === 'project' && (!parentPassesProjet || !parentPassesStatut)) continue;
    }

    const newParent: ParentRow = { ...parent, children: [], metrics: new Map() };
    let cMatchesAny = false;

    for (const child of parent.children) {
      const cMatchesSelf = matchesRowText(child);
      let gMatchesAny = false;
      const childPassesStatut =
        !criteria.filterStatusIds.length || viewMode !== 'team' || !child.originalProject || criteria.filterStatusIds.includes(child.originalProject.statut);

      let childPassesLargeProject = true;
      if (sizeEnabled && viewMode === 'team') {
        const val = sizeCriterion.startsWith('charges_')
          ? getPlannedDaysForChildInTeam(child, sizeCriterion.substring(8) as PlannedDaysPeriod, todayWeekStart)
          : getChiffreValueForTeamProject(dataset, parent.id, child.id, sizeCriterion.substring(8) as ChiffreCategory);
        childPassesLargeProject = checkSizeMatch(val, sizeOperator, sizeValue);
      }

      if (viewMode === 'team' && (!childPassesStatut || !childPassesLargeProject)) continue;
      if (periodEnabled && (viewMode === 'team' || viewMode === 'project') && !hasChargesInPeriod(child.charges, periodStart, periodEnd)) continue;

      let grandchildrenMatch = child.resources;
      if (hasSpecificFilter || search.length > 0) {
        grandchildrenMatch = child.resources.filter((gr) => {
          let passesLargeProject = true;
          if (sizeEnabled) {
            const teamId = isResourceMode ? parent.id.split('_')[0] : viewMode === 'project' ? child.id : parent.id;
            const projectId = isProjectLeafMode ? gr.projectId || gr.id : viewMode === 'project' ? parent.id : child.id;
            const val = sizeCriterion.startsWith('charges_')
              ? getPlannedDaysForResource(gr, sizeCriterion.substring(8) as PlannedDaysPeriod, todayWeekStart)
              : isServiceMode
                ? getChiffreValueForServiceProject(dataset.allChiffres, parent.id, projectId, sizeCriterion.substring(8) as ChiffreCategory)
                : getChiffreValueForMode(dataset, teamId, projectId, gr.resourceId, gr.type, sizeCriterion.substring(8) as ChiffreCategory);
            passesLargeProject = checkSizeMatch(val, sizeOperator, sizeValue);
          }

          let passesIdFilter = true;
          if (criteria.filterResourceIds.length || criteria.filterProjetIds.length || criteria.filterStatusIds.length || sizeEnabled) {
            if (isProjectLeafMode) {
              const project = dataset.allProjects.find((p) => p.id === gr.projectId);
              const passesStatut = criteria.filterStatusIds.length === 0 || (!!project && criteria.filterStatusIds.includes(project.statut));
              passesIdFilter = (criteria.filterProjetIds.length === 0 || criteria.filterProjetIds.includes(gr.projectId!)) && passesStatut && passesLargeProject;
            } else {
              const passesResourceFilter =
                criteria.filterResourceIds.length === 0 ||
                criteria.filterResourceIds.some((sel) => {
                  const [t, id] = sel.split(':');
                  return gr.type === t && gr.id === id;
                });
              passesIdFilter = passesResourceFilter && passesLargeProject;
            }
          }

          let passesSearch = true;
          if (search) {
            if (isResourceMode) passesSearch = matchingProjetIds.has(gr.id);
            else if (isServiceMode) passesSearch = pMatches || matchingProjetIds.has(gr.id);
            else if (!pMatches && !cMatchesSelf) passesSearch = resourceMatchesSearchSelf(gr);
          }

          const passesPeriod = !periodEnabled || hasChargesInPeriod(gr.charges, periodStart, periodEnd);
          const isMatch = passesIdFilter && passesSearch && passesPeriod;
          if (isMatch) gMatchesAny = true;
          return isMatch;
        });
      }

      const childPassesEquipe = !criteria.filterEquipeIds.length || viewMode !== 'project' || criteria.filterEquipeIds.includes(child.id);
      const childPassesProjet = !criteria.filterProjetIds.length || viewMode !== 'team' || criteria.filterProjetIds.includes(child.id);
      const childPassesResource = !criteria.filterResourceIds.length || !isResourceMode || parentPassesResource;
      const hasGrandchildFilter = isProjectLeafMode
        ? criteria.filterProjetIds.length > 0 || criteria.filterStatusIds.length > 0 || periodEnabled || sizeEnabled
        : criteria.filterResourceIds.length > 0 || periodEnabled || sizeEnabled;
      const hasGrandchildrenMatch = hasGrandchildFilter ? grandchildrenMatch.length > 0 : true;
      const childMatches = cMatchesSelf || gMatchesAny;
      const childPassesSearch = !search || (pMatches && !isResourceMode) || childMatches;

      if (childPassesEquipe && childPassesProjet && childPassesResource && hasGrandchildrenMatch && childPassesSearch) {
        if (childMatches) cMatchesAny = true;
        newParent.children.push({ ...child, resources: grandchildrenMatch, metrics: new Map() });
      }
    }

    const hasChildren = newParent.children.length > 0;
    if (search && cMatchesAny) newParent.expanded = true;

    const showEmptyParent =
      criteria.filterResourceIds.length === 0 &&
      ((viewMode === 'project' && criteria.filterProjetIds.includes(parent.id) && criteria.filterEquipeIds.length === 0) ||
        ((viewMode === 'team' || isResourceMode) && criteria.filterEquipeIds.includes(parent.id) && criteria.filterProjetIds.length === 0));

    if (parentPassesEquipe && parentPassesResource && parentPassesProjet && parentPassesStatut && (hasChildren || showEmptyParent || (search && pMatches))) {
      filteredParents.push(newParent);
    }
  }

  return filteredParents;
}
