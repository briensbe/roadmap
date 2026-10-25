/**
 * @file plan-projection.engine.ts
 * @description Moteur de calcul et de projection métier pur (Deep Module sans dépendance Angular ni DOM).
 *
 * Responsabilités :
 * - Construire l'arbre hiérarchique (`buildPlanTree`) selon les 4 modes de vue (`project`, `team`, `resource`, `service`).
 * - Calculer l'utilisation, la disponibilité nette (`capacité - charge`), les cellules pré-calculées
 *   et les métriques hebdomadaires agrégées (`calculateTreeMetrics`, `calculateFilteredTreeMetrics`).
 * - Agréger les jours planifiés (RAF, année, tout) et résoudre les chiffres budgétaires par service, équipe et projet.
 * - Appliquer le filtrage multicritères hiérarchique (`applyPlanFilters`).
 */
import { Charge, Projet } from '../../models/types';
import { textContains } from '../../utils/text.utils';
import { sortByRank } from '../../utils/lexorank.utils';
import {
  PlanViewMode,
  PlannedDaysPeriod,
  ChiffreCategory,
  ResourceRow,
  ChildRow,
  ParentRow,
  PlanRawDataset,
  PlanFilterCriteria,
} from './plan-view.models';
export * from './plan-metrics.calculator';
import {
  getPlannedDaysForResource,
  getPlannedDaysForProjectParent,
  getChildTotalPlannedDays,
  getChiffreValueForMode,
  getChiffreValueForServiceProject,
  getChiffreValueForTeamProject,
  getChiffreValueForProjectParent,
  checkSizeMatch,
  hasChargesInPeriod,
} from './plan-metrics.calculator';

export function formatWeekStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function cleanJiraRef(ref: string | null | undefined): string {
  if (!ref) return '';
  const match = ref.match(/(SUIVI-\d+)/i);
  return match ? match[1].toUpperCase() : ref.trim();
}

/** Helpers de construction et d'analyse des identifiants et clés composites */
export function buildActorKey(type: 'role' | 'personne', id?: string): string {
  return `${type}_${id || ''}`;
}

export function buildResourceRowId(teamId: string | undefined, actorKey: string): string {
  return `${teamId || ''}_${actorKey}`;
}

export function extractTeamIdFromRowId(rowId: string): string {
  return rowId.split('_')[0];
}

export function parseResourceRowId(rowId: string): { teamId: string; actorType: 'role' | 'personne'; actorId: string } | null {
  const parts = rowId.split('_');
  if (parts.length >= 3 && (parts[1] === 'role' || parts[1] === 'personne')) {
    return {
      teamId: parts[0],
      actorType: parts[1],
      actorId: parts.slice(2).join('_'),
    };
  }
  return null;
}

export function buildServiceProjectUniqueId(serviceId: string | undefined, projectId: string): string {
  return `service_project_${serviceId || ''}_${projectId}`;
}

export function buildServiceSummaryUniqueId(serviceId: string | undefined): string {
  return `service_summary_${serviceId || ''}`;
}

export function buildServiceResourceUniqueId(serviceId: string | undefined, projectId: string, teamId: string | undefined, actorKey: string): string {
  return `service_${serviceId || ''}_${projectId}_${teamId || ''}_${actorKey}`;
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
    if ((resource.charges.get(formatWeekStart(week)) || 0) === 0) return false;
  }
  return true;
}

function resolveChargeActor(dataset: Pick<PlanRawDataset, 'availableRoles' | 'availablePersonnes'>, charge: Charge, fallbackDays = 0) {
  if (charge.role_id) {
    const role = dataset.availableRoles.find((r) => r.id === charge.role_id);
    return {
      id: charge.role_id,
      key: buildActorKey('role', charge.role_id),
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
      key: buildActorKey('personne', charge.personne_id),
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
      resource.charges.set(weekKey, Math.round(((resource.charges.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
      if (charge.comment) resource.comments?.set(weekKey, charge.comment);
      childTotals.set(weekKey, Math.round(((childTotals.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
      parentTotals.set(weekKey, Math.round(((parentTotals.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
    }
  }
  return Array.from(resourceMap.values())
    .filter((r) => shouldShowResourceByWeekFilters(r, weekFilters, displayedWeeks))
    .sort((a, b) => a.label.localeCompare(b.label));
}

interface TreeBuildContext {
  dataset: PlanRawDataset;
  manualStates: Map<string, boolean>;
  isDefaultExpanded: boolean;
  weekFilters: number[];
  displayedWeeks: Date[];
  activeEquipeIds: string[];
  activeResourceIds: string[];
}

function buildProjectTree(ctx: TreeBuildContext): ParentRow[] {
  const { dataset, manualStates, isDefaultExpanded, weekFilters, displayedWeeks } = ctx;
  const rows: ParentRow[] = [];
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
  return rows;
}

function buildTeamTree(ctx: TreeBuildContext): ParentRow[] {
  const { dataset, manualStates, isDefaultExpanded, weekFilters, displayedWeeks } = ctx;
  const rows: ParentRow[] = [];
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
  return rows;
}

function buildResourceTree(ctx: TreeBuildContext): ParentRow[] {
  const { dataset, manualStates, isDefaultExpanded, weekFilters, displayedWeeks } = ctx;
  const rows: ParentRow[] = [];
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
        resourceMap.set(buildActorKey('role', role.id), {
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
      resourceMap.set(buildActorKey('personne', p.id!), {
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
        res.charges.set(weekKey, Math.round(((res.charges.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
        if (charge.comment) res.comments.set(weekKey, charge.comment);
        const detRow = res.projectDetailedMap.get(pId)!;
        detRow.charges.set(weekKey, Math.round(((detRow.charges.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
        if (charge.comment) detRow.comments?.set(weekKey, charge.comment);
      }
    }

    resourceMap.forEach((res, rKey) => {
      const projectResources = sortByRank(
        Array.from(res.projectDetailedMap.values()),
        (r) => dataset.allProjects.find((p) => p.id === r.projectId)?.rank,
        (a, b) => a.label.localeCompare(b.label),
      ).filter((r) => shouldShowResourceByWeekFilters(r, weekFilters, displayedWeeks));

      const rowId = buildResourceRowId(team.id, rKey);
      rows.push({
        id: rowId,
        label: `${team.nom} - ${res.label}`,
        code: team.code,
        color: team.color,
        expanded: manualStates.get(rowId) ?? isDefaultExpanded,
        children: [{ id: rKey, label: res.label, color: res.color, expanded: true, charges: res.charges, resources: projectResources }],
        totalCharges: res.charges,
      });
    });
  }
  return rows;
}

function buildServiceTree(ctx: TreeBuildContext): ParentRow[] {
  const { dataset, manualStates, isDefaultExpanded, weekFilters, displayedWeeks, activeEquipeIds, activeResourceIds } = ctx;
  const rows: ParentRow[] = [];
  const sortedServices = [...dataset.allServices].sort((a, b) => a.nom.localeCompare(b.nom));

  for (const service of sortedServices) {
    const parentTotal = new Map<string, number>();
    const parentDailyCharges = new Map<string, number>();
    const projectMap = new Map<
      string,
      {
        project?: Projet;
        childCharges: Map<string, number>;
        childDailyCharges: Map<string, number>;
        resourceMap: Map<string, ResourceRow>;
      }
    >();

    for (const charge of dataset.allCharges) {
      const actor = resolveChargeActor(dataset, charge, 5);
      if (!actor) continue;
      if (activeEquipeIds.length > 0 && (!charge.equipe_id || !activeEquipeIds.includes(charge.equipe_id))) continue;
      if (activeResourceIds.length > 0 && !activeResourceIds.includes(`${actor.type}:${actor.id}`)) continue;
      if (getResourceServiceId(dataset, actor.type, actor.id, charge.equipe_id) !== service.id) continue;

      const pId = charge.projet_id || 'no_project';
      if (!projectMap.has(pId)) {
        const project = dataset.allProjects.find((p) => p.id === pId);
        projectMap.set(pId, {
          project,
          childCharges: new Map<string, number>(),
          childDailyCharges: new Map<string, number>(),
          resourceMap: new Map<string, ResourceRow>(),
        });
      }

      const projEntry = projectMap.get(pId)!;
      const equipe = dataset.allEquipes.find((e) => e.id === charge.equipe_id);
      const resKey = `${charge.equipe_id || 'no_team'}_${actor.key}`;

      if (!projEntry.resourceMap.has(resKey)) {
        projEntry.resourceMap.set(resKey, {
          id: actor.id,
          uniqueId: buildServiceResourceUniqueId(service.id, pId, charge.equipe_id || 'no_team', actor.key),
          label: `${equipe?.nom || 'Équipe'} - ${actor.label}`,
          type: actor.type,
          jours_par_semaine: actor.jours,
          charges: new Map<string, number>(),
          dailyCharges: new Map<string, number>(),
          comments: new Map<string, string>(),
          color: equipe?.color || actor.color,
          resourceId: actor.id,
          projectId: pId,
          equipeId: charge.equipe_id,
        });
      }

      const resRow = projEntry.resourceMap.get(resKey)!;
      const weekKey = charge.semaine_debut?.split('T')[0];
      if (weekKey) {
        parentTotal.set(weekKey, Math.round(((parentTotal.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
        parentDailyCharges.set(weekKey, Math.round(((parentDailyCharges.get(weekKey) || 0) + charge.unite_ressource * actor.jours) * 100) / 100);

        projEntry.childCharges.set(weekKey, Math.round(((projEntry.childCharges.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
        projEntry.childDailyCharges.set(weekKey, Math.round(((projEntry.childDailyCharges.get(weekKey) || 0) + charge.unite_ressource * actor.jours) * 100) / 100);

        resRow.charges.set(weekKey, Math.round(((resRow.charges.get(weekKey) || 0) + charge.unite_ressource) * 100) / 100);
        resRow.dailyCharges!.set(weekKey, Math.round(((resRow.dailyCharges!.get(weekKey) || 0) + charge.unite_ressource * actor.jours) * 100) / 100);
        if (charge.comment) {
          resRow.comments?.set(weekKey, charge.comment);
        }
      }
    }

    const children: ChildRow[] = [];
    const sortedProjectEntries = Array.from(projectMap.entries()).sort(([_pIdA, a], [_pIdB, b]) => {
      const rankA = a.project?.rank;
      const rankB = b.project?.rank;
      if (rankA !== undefined && rankB !== undefined) {
        const c = rankA.localeCompare(rankB);
        if (c !== 0) return c;
      }
      const nameA = a.project?.nom_projet || 'Sans projet';
      const nameB = b.project?.nom_projet || 'Sans projet';
      return nameA.localeCompare(nameB);
    });

    for (const [pId, entry] of sortedProjectEntries) {
      const sortedResources = Array.from(entry.resourceMap.values())
        .filter((r) => shouldShowResourceByWeekFilters(r, weekFilters, displayedWeeks))
        .sort((a, b) => a.label.localeCompare(b.label));

      const isChildExpanded = manualStates.get(`${service.id}_${pId}`) ?? isDefaultExpanded;

      const projectSummaryResource: ResourceRow = {
        id: pId,
        uniqueId: buildServiceProjectUniqueId(service.id, pId),
        label: entry.project ? entry.project.nom_projet : 'Sans projet',
        code: entry.project?.code_projet,
        reference_externe: entry.project?.reference_externe,
        type: 'role',
        jours_par_semaine: 5,
        charges: entry.childCharges,
        dailyCharges: entry.childDailyCharges,
        color: entry.project?.color,
        projectId: pId,
        resourceId: service.id,
      };

      children.push({
        id: pId,
        label: entry.project ? entry.project.nom_projet : 'Sans projet',
        code: entry.project?.code_projet,
        reference_externe: entry.project?.reference_externe,
        color: entry.project?.color,
        expanded: isChildExpanded,
        resources: sortedResources,
        charges: entry.childCharges,
        dailyCharges: entry.childDailyCharges,
        originalProject: entry.project,
        summaryResource: projectSummaryResource,
      });
    }

    const isExpanded = manualStates.get(service.id!) ?? isDefaultExpanded;
    rows.push({
      id: service.id!,
      label: service.nom,
      expanded: isExpanded,
      children,
      totalCharges: parentTotal,
      summaryResource: {
        id: service.id!,
        uniqueId: buildServiceSummaryUniqueId(service.id),
        label: service.nom,
        type: 'role',
        jours_par_semaine: 5,
        charges: parentTotal,
        dailyCharges: parentDailyCharges,
      },
    });
  }
  return rows;
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
  const ctx: TreeBuildContext = {
    dataset,
    manualStates,
    isDefaultExpanded,
    weekFilters,
    displayedWeeks,
    activeEquipeIds,
    activeResourceIds,
  };

  switch (viewMode) {
    case 'project':
      return buildProjectTree(ctx);
    case 'team':
      return buildTeamTree(ctx);
    case 'resource':
      return buildResourceTree(ctx);
    case 'service':
      return buildServiceTree(ctx);
    default:
      return [];
  }
}

export function calculateUsageMap(dataset: Pick<PlanRawDataset, 'allCharges' | 'usageMap'>): void {
  dataset.usageMap.clear();
  for (const charge of dataset.allCharges) {
    if (!charge.semaine_debut || !charge.equipe_id) continue;
    const weekKey = charge.semaine_debut.split('T')[0];
    const resourceKey = charge.role_id ? `role_${charge.role_id}` : charge.personne_id ? `personne_${charge.personne_id}` : null;
    if (!resourceKey) continue;
    const mapKey = `${charge.equipe_id}_${resourceKey}_${weekKey}`;
    const nextVal = Math.round(((dataset.usageMap.get(mapKey) || 0) + charge.unite_ressource) * 100) / 100;
    dataset.usageMap.set(mapKey, nextVal);
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
  const raw = (dataset.capacityIndex.get(mapKey) || 0) - (dataset.usageMap.get(mapKey) || 0);
  return Math.round(raw * 100) / 100;
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
  const effectiveTeamId = resource.equipeId || teamId;

  for (const week of displayedWeeks) {
    const weekKey = formatWeekStart(week);
    const value = resource.charges.get(weekKey) || 0;
    const availability = getAvailability(dataset, resource, week, effectiveTeamId);
    const rId = resource.resourceId || resource.id;
    const hasCapRecord =
      dataset.capacityIndex.has(`${effectiveTeamId}_${resource.type}_${rId}_${weekKey}`) ||
      dataset.allCapacities.some(
        (c) =>
          c.equipe_id === effectiveTeamId &&
          c.semaine_debut.startsWith(weekKey) &&
          (resource.type === 'role' ? c.role_id === rId : c.personne_id === rId),
      );
    const isRelevant =
      resource.type === 'personne'
        ? (dataset.availablePersonnes.find((p) => p.id === rId)?.equipe_id === effectiveTeamId)
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
        const effectiveTeamId = viewMode === 'service' ? (resource.equipeId || teamId) : teamId;
        precalculateResource(dataset, viewMode, displayedWeeks, resource, effectiveTeamId);
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
        const parsed = parseResourceRowId(parent.id);
        const capKey = parsed ? `${parsed.teamId}_${parsed.actorType}_${parsed.actorId}_${weekKey}` : '';
        totalCapacity = capKey ? (dataset.capacityIndex.get(capKey) || 0) : 0;
      } else if (viewMode === 'service' && serviceResourceKeys) {
        total = parent.totalCharges?.get(weekKey) || 0;
        for (const resKey of serviceResourceKeys) {
          totalCapacity += dataset.capacityIndex.get(`${resKey}_${weekKey}`) || 0;
        }
      } else if (viewMode === 'team') {
        const teamRoleAtts = dataset.allRoleAttachments.filter((a) => a.equipe_id === parent.id);
        const teamPersonnes = dataset.availablePersonnes.filter((p) => p.equipe_id === parent.id);
        for (const att of teamRoleAtts) {
          if (activeResourceIds.length > 0 && !activeResourceIds.includes(`role:${att.role_id}`)) continue;
          totalCapacity += dataset.capacityIndex.get(`${parent.id}_role_${att.role_id}_${weekKey}`) || 0;
        }
        for (const p of teamPersonnes) {
          if (activeResourceIds.length > 0 && !activeResourceIds.includes(`personne:${p.id}`)) continue;
          totalCapacity += dataset.capacityIndex.get(`${parent.id}_personne_${p.id}_${weekKey}`) || 0;
        }
      }

      const totalRounded = Math.round(total * 100) / 100;
      const capRounded = Math.round(totalCapacity * 100) / 100;
      const availability = Math.round((capRounded - totalRounded) * 100) / 100;
      const status = capRounded > 0 || totalRounded > 0 ? (availability > 0 ? 'positive' : availability === 0 ? 'zero' : 'negative') : 'none';
      parent.metrics.set(weekKey, { total: totalRounded, capacity: capRounded, availability, status });
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
  const isProjectLeafMode = isResourceMode;

  for (const parent of rowsAll) {
    const pMatches = matchesRowText(parent);
    const parentPassesEquipe =
      !criteria.filterEquipeIds.length ||
      (viewMode === 'team' ? criteria.filterEquipeIds.includes(parent.id) : isResourceMode ? criteria.filterEquipeIds.includes(extractTeamIdFromRowId(parent.id)) : true);
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
        !criteria.filterStatusIds.length || (viewMode !== 'team' && viewMode !== 'service') || !child.originalProject || criteria.filterStatusIds.includes(child.originalProject.statut);

      let childPassesLargeProject = true;
      if (sizeEnabled && (viewMode === 'team' || viewMode === 'service')) {
        const val = sizeCriterion.startsWith('charges_')
          ? getChildTotalPlannedDays(child, sizeCriterion.substring(8) as PlannedDaysPeriod, null, todayWeekStart)
          : viewMode === 'service'
            ? getChiffreValueForServiceProject(dataset.allChiffres, parent.id, child.id, sizeCriterion.substring(8) as ChiffreCategory)
            : getChiffreValueForTeamProject(dataset, parent.id, child.id, sizeCriterion.substring(8) as ChiffreCategory);
        childPassesLargeProject = checkSizeMatch(val, sizeOperator, sizeValue);
      }

      if ((viewMode === 'team' || viewMode === 'service') && (!childPassesStatut || !childPassesLargeProject)) continue;
      if (periodEnabled && (viewMode === 'team' || viewMode === 'project' || viewMode === 'service') && !hasChargesInPeriod(child.charges, periodStart, periodEnd)) continue;

      let grandchildrenMatch = child.resources;
      if (hasSpecificFilter || search.length > 0) {
        grandchildrenMatch = child.resources.filter((gr) => {
          let passesLargeProject = true;
          if (sizeEnabled && isProjectLeafMode) {
            const teamId = extractTeamIdFromRowId(parent.id);
            const projectId = gr.projectId || gr.id;
            const val = sizeCriterion.startsWith('charges_')
              ? getPlannedDaysForResource(gr, sizeCriterion.substring(8) as PlannedDaysPeriod, todayWeekStart)
              : getChiffreValueForMode(dataset, teamId, projectId, gr.resourceId, gr.type, sizeCriterion.substring(8) as ChiffreCategory);
            passesLargeProject = checkSizeMatch(val, sizeOperator, sizeValue);
          }

          let passesIdFilter = true;
          if (criteria.filterResourceIds.length || criteria.filterEquipeIds.length || criteria.filterProjetIds.length || criteria.filterStatusIds.length || sizeEnabled) {
            if (isProjectLeafMode) {
              const project = dataset.allProjects.find((p) => p.id === gr.projectId);
              const passesStatut = criteria.filterStatusIds.length === 0 || (!!project && criteria.filterStatusIds.includes(project.statut));
              passesIdFilter = (criteria.filterProjetIds.length === 0 || criteria.filterProjetIds.includes(gr.projectId!)) && passesStatut && passesLargeProject;
            } else {
              const passesResourceFilter =
                criteria.filterResourceIds.length === 0 ||
                criteria.filterResourceIds.some((sel) => {
                  const [t, id] = sel.split(':');
                  return gr.type === t && (gr.resourceId === id || gr.id === id);
                });
              const passesEquipeFilter =
                criteria.filterEquipeIds.length === 0 ||
                !gr.equipeId ||
                criteria.filterEquipeIds.includes(gr.equipeId);
              passesIdFilter = passesResourceFilter && passesEquipeFilter && passesLargeProject;
            }
          }

          let passesSearch = true;
          if (search) {
            if (isResourceMode) passesSearch = matchingProjetIds.has(gr.id);
            else if (!pMatches && !cMatchesSelf) passesSearch = resourceMatchesSearchSelf(gr);
          }

          const passesPeriod = !periodEnabled || hasChargesInPeriod(gr.charges, periodStart, periodEnd);
          const isMatch = passesIdFilter && passesSearch && passesPeriod;
          if (isMatch) gMatchesAny = true;
          return isMatch;
        });
      }

      const childPassesEquipe = !criteria.filterEquipeIds.length || viewMode !== 'project' || criteria.filterEquipeIds.includes(child.id);
      const childPassesProjet = !criteria.filterProjetIds.length || (viewMode !== 'team' && viewMode !== 'service') || criteria.filterProjetIds.includes(child.id);
      const childPassesResource = !criteria.filterResourceIds.length || !isResourceMode || parentPassesResource;
      const hasGrandchildFilter = isProjectLeafMode
        ? criteria.filterProjetIds.length > 0 || criteria.filterStatusIds.length > 0 || periodEnabled || sizeEnabled
        : criteria.filterResourceIds.length > 0 || criteria.filterEquipeIds.length > 0 || periodEnabled || sizeEnabled;
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
