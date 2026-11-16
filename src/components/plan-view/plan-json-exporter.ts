/**
 * @file plan-json-exporter.ts
 * @description Générateur et exportateur de données JSON structurées pour la vue Planification.
 *
 * Responsabilités :
 * - Compiler l'ensemble des données visibles dans la vue Planification (projets, équipes, ressources,
 *   chiffres, jalons, métriques et charges hebdomadaires) en tenant compte des filtres positionnés.
 * - Structurer l'export en nœuds logiques cohérents (métadonnées, synthèse, projets, équipes, arborescence).
 * - Déclencher le téléchargement du fichier JSON dans le navigateur.
 */
import {
  ParentRow,
  PlanViewMode,
  PlanRawDataset,
  PlanFilterCriteria,
  ChiffreCategory,
  ResourceRow,
} from './plan-view.models';
import { formatWeekStart } from './plan-projection.engine';
import { sumChiffresForTeamIds } from './plan-metrics.calculator';

export interface PlanJsonExportParams {
  rows: ParentRow[];
  dataset: PlanRawDataset;
  displayedWeeks: Date[];
  viewMode: PlanViewMode;
  criteria: PlanFilterCriteria;
  chiffreMode: ChiffreCategory;
}

export interface PlanExportPlanification {
  semaine: string;
  jours: number;
  commentaire?: string | null;
}

export interface PlanExportRessource {
  id: string;
  nom: string;
  type: 'role' | 'personne';
  joursParSemaine: number;
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  planifications: PlanExportPlanification[];
}

export interface PlanExportProjetEquipe {
  id: string;
  nom: string;
  code?: string | null;
  couleur?: string | null;
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  ressources: PlanExportRessource[];
}

export interface PlanExportJalon {
  id?: string;
  titre: string;
  type: string;
  date: string;
  description?: string;
}

export interface PlanExportChiffres {
  initial: number;
  revise: number;
  previsionnel: number;
  consomme: number;
  restant: number;
}

export interface PlanExportProjet {
  id: string;
  code?: string | null;
  referenceExterne?: string | null;
  nom: string;
  statut?: string | null;
  chefProjet?: string | null;
  couleur?: string | null;
  rang?: string | null;
  chiffres: PlanExportChiffres;
  jalons: PlanExportJalon[];
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  equipes: PlanExportProjetEquipe[];
}

export interface PlanExportEquipeProjet {
  id: string;
  code?: string | null;
  referenceExterne?: string | null;
  nom: string;
  statut?: string | null;
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  ressources: PlanExportRessource[];
}

export interface PlanExportMetriqueSemaine {
  totalCharge: number;
  capacite: number;
  disponibilite: number;
  statut: 'positive' | 'zero' | 'negative' | 'none';
}

export interface PlanExportEquipe {
  id: string;
  nom: string;
  code?: string | null;
  couleur?: string | null;
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  metriquesHebdomadaires?: Record<string, PlanExportMetriqueSemaine>;
  projets: PlanExportEquipeProjet[];
}

export interface PlanExportArborescenceRessource {
  id: string;
  libelle: string;
  type: 'role' | 'personne';
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  commentaires?: Record<string, string>;
}

export interface PlanExportArborescenceEnfant {
  id: string;
  libelle: string;
  code?: string | null;
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  ressources: PlanExportArborescenceRessource[];
}

export interface PlanExportArborescenceLigne {
  id: string;
  libelle: string;
  code?: string | null;
  referenceExterne?: string | null;
  couleur?: string | null;
  totalJoursPlanifies: number;
  chargesParSemaine: Record<string, number>;
  enfants: PlanExportArborescenceEnfant[];
}

export interface PlanExportArborescence {
  mode: PlanViewMode;
  lignes: PlanExportArborescenceLigne[];
}

export interface PlanExportMetadonnees {
  dateExport: string;
  modeVue: PlanViewMode;
  categorieChiffre: ChiffreCategory;
  periode: {
    dateDebut: string;
    dateFin: string;
    nombreSemaines: number;
    semaines: string[];
  };
  filtresAppliques: {
    rechercheGlobale: string | null;
    equipes: string[];
    projets: string[];
    ressources: string[];
    statuts: string[];
    filtrePeriode: {
      actif: boolean;
      debut: string | null;
      fin: string | null;
    };
    filtreTaille: {
      actif: boolean;
      critere: string;
      operateur: string;
      valeur: number | null;
    };
    filtresSemaines: number[];
  };
}

export interface PlanExportSynthese {
  totalJoursPlanifies: number;
  nombreProjets: number;
  nombreEquipes: number;
  nombreRessources: number;
  totauxParSemaine: Record<string, number>;
}

export interface PlanExportJsonStructure {
  metadonnees: PlanExportMetadonnees;
  synthese: PlanExportSynthese;
  projets: PlanExportProjet[];
  equipes: PlanExportEquipe[];
  arborescenceVue: PlanExportArborescence;
}

/**
 * Résout la cible (projetId, equipeId) selon le mode de vue actif.
 */
export function resolveResourceTargetForExport(
  viewMode: PlanViewMode,
  parentId: string,
  childId: string,
  resource: ResourceRow,
): { projetId: string; equipeId: string; roleId?: string; personneId?: string } {
  let projetId: string;
  let equipeId: string;

  if (viewMode === 'project') {
    projetId = parentId;
    equipeId = childId;
  } else if (viewMode === 'team') {
    equipeId = parentId;
    projetId = childId;
  } else if (viewMode === 'service') {
    projetId = childId;
    equipeId = resource.equipeId || parentId;
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

/**
 * Construit l'objet JSON complet de la vue planification en regroupant
 * l'ensemble des informations filtrées dans des nœuds logiques.
 */
export function buildPlanJsonExport(params: PlanJsonExportParams): PlanExportJsonStructure {
  const { rows, dataset, displayedWeeks, viewMode, criteria, chiffreMode } = params;

  const displayedWeekKeys = displayedWeeks.map((w) => formatWeekStart(w));
  const displayedWeekSet = new Set(displayedWeekKeys);

  // 1. Métadonnées
  const metadonnees: PlanExportMetadonnees = {
    dateExport: new Date().toISOString(),
    modeVue: viewMode,
    categorieChiffre: chiffreMode,
    periode: {
      dateDebut: displayedWeekKeys[0] || '',
      dateFin: displayedWeekKeys[displayedWeekKeys.length - 1] || '',
      nombreSemaines: displayedWeekKeys.length,
      semaines: displayedWeekKeys,
    },
    filtresAppliques: {
      rechercheGlobale: criteria.globalSearch?.trim() ? criteria.globalSearch.trim() : null,
      equipes: criteria.filterEquipeIds
        .map((id) => dataset.allEquipes.find((e) => e.id === id)?.nom || id),
      projets: criteria.filterProjetIds
        .map((id) => dataset.allProjects.find((p) => p.id === id)?.nom_projet || id),
      ressources: criteria.filterResourceIds.map((id) => {
        const pers = dataset.availablePersonnes.find((p) => p.id === id);
        if (pers) return `${pers.prenom} ${pers.nom}`;
        const role = dataset.availableRoles.find((r) => r.id === id);
        return role ? role.nom : id;
      }),
      statuts: [...criteria.filterStatusIds],
      filtrePeriode: {
        actif: criteria.filterPeriodEnabled,
        debut: criteria.effectivePeriodStart || null,
        fin: criteria.effectivePeriodEnd || null,
      },
      filtreTaille: {
        actif: criteria.filterSizeEnabled && criteria.filterSizeValue !== null,
        critere: criteria.filterSizeCriterion,
        operateur: criteria.filterSizeOperator,
        valeur: criteria.filterSizeValue,
      },
      filtresSemaines: [...criteria.weekFilters],
    },
  };

  // Structures temporaires d'agrégation
  const projectMap = new Map<
    string,
    {
      teamsMap: Map<
        string,
        {
          resourcesMap: Map<string, PlanExportRessource>;
        }
      >;
    }
  >();

  const teamMap = new Map<
    string,
    {
      metrics?: Record<string, PlanExportMetriqueSemaine>;
      projectsMap: Map<
        string,
        {
          resourcesMap: Map<string, PlanExportRessource>;
        }
      >;
    }
  >();

  const globalWeeklyTotals: Record<string, number> = {};
  const allUniqueResourceIds = new Set<string>();

  // Parcourir l'arbre filtré pour alimenter les nœuds logiques
  for (const parent of rows) {
    // Si la vue est par équipe, capturer les métriques d'équipe si présentes
    if (viewMode === 'team' && parent.metrics) {
      if (!teamMap.has(parent.id)) {
        teamMap.set(parent.id, { projectsMap: new Map(), metrics: {} });
      }
      const entry = teamMap.get(parent.id)!;
      entry.metrics = {};
      parent.metrics.forEach((item, wKey) => {
        if (displayedWeekSet.has(wKey)) {
          entry.metrics![wKey] = {
            totalCharge: Math.round(item.total * 100) / 100,
            capacite: Math.round(item.capacity * 100) / 100,
            disponibilite: Math.round(item.availability * 100) / 100,
            statut: item.status,
          };
        }
      });
    }

    // Référencer d'éventuels projets ou équipes affichés sans ressources
    if (viewMode === 'project') {
      if (!projectMap.has(parent.id)) {
        projectMap.set(parent.id, { teamsMap: new Map() });
      }
    } else if (viewMode === 'team') {
      if (!teamMap.has(parent.id)) {
        teamMap.set(parent.id, { projectsMap: new Map() });
      }
    }

    for (const child of parent.children) {
      if (viewMode === 'project') {
        const prjEntry = projectMap.get(parent.id)!;
        if (!prjEntry.teamsMap.has(child.id)) {
          prjEntry.teamsMap.set(child.id, { resourcesMap: new Map() });
        }
        if (!teamMap.has(child.id)) {
          teamMap.set(child.id, { projectsMap: new Map() });
        }
      } else if (viewMode === 'team') {
        const tmEntry = teamMap.get(parent.id)!;
        if (!tmEntry.projectsMap.has(child.id)) {
          tmEntry.projectsMap.set(child.id, { resourcesMap: new Map() });
        }
        if (!projectMap.has(child.id)) {
          projectMap.set(child.id, { teamsMap: new Map() });
        }
      }

      for (const res of child.resources) {
        const target = resolveResourceTargetForExport(viewMode, parent.id, child.id, res);
        const pId = target.projetId;
        const eId = target.equipeId;
        const rId = target.personneId || target.roleId || res.resourceId || res.id;

        allUniqueResourceIds.add(`${res.type}_${rId}`);

        // Extraire les charges et commentaires pour les semaines affichées
        const chargesParSemaine: Record<string, number> = {};
        const planifications: PlanExportPlanification[] = [];
        let resTotal = 0;

        for (const wKey of displayedWeekKeys) {
          const val = res.charges?.get(wKey) || 0;
          const comment = res.comments?.get(wKey) || null;

          if (val > 0) {
            const rounded = Math.round(val * 100) / 100;
            chargesParSemaine[wKey] = rounded;
            resTotal += rounded;
            globalWeeklyTotals[wKey] = Math.round(((globalWeeklyTotals[wKey] || 0) + rounded) * 100) / 100;
          }

          if (val > 0 || comment) {
            planifications.push({
              semaine: wKey,
              jours: Math.round(val * 100) / 100,
              commentaire: comment,
            });
          }
        }

        const resExportItem: PlanExportRessource = {
          id: rId,
          nom: res.label,
          type: res.type,
          joursParSemaine: res.jours_par_semaine || 5,
          totalJoursPlanifies: Math.round(resTotal * 100) / 100,
          chargesParSemaine,
          planifications,
        };

        // Enregistrer sous l'arborescence projet
        if (!projectMap.has(pId)) {
          projectMap.set(pId, { teamsMap: new Map() });
        }
        const prjEntry = projectMap.get(pId)!;
        if (!prjEntry.teamsMap.has(eId)) {
          prjEntry.teamsMap.set(eId, { resourcesMap: new Map() });
        }
        prjEntry.teamsMap.get(eId)!.resourcesMap.set(res.uniqueId || `${eId}_${rId}_${pId}`, resExportItem);

        // Enregistrer sous l'arborescence équipe
        if (!teamMap.has(eId)) {
          teamMap.set(eId, { projectsMap: new Map() });
        }
        const tmEntry = teamMap.get(eId)!;
        if (!tmEntry.projectsMap.has(pId)) {
          tmEntry.projectsMap.set(pId, { resourcesMap: new Map() });
        }
        tmEntry.projectsMap.get(pId)!.resourcesMap.set(res.uniqueId || `${eId}_${rId}_${pId}`, resExportItem);
      }
    }
  }

  // 2. Nœud "projets"
  const projets: PlanExportProjet[] = [];
  let totalJoursPlanifiesGlobal = 0;

  projectMap.forEach((pData, pId) => {
    const prjObj = dataset.allProjects.find((p) => p.id === pId);
    const nom = prjObj?.nom_projet || rows.find((r) => r.id === pId)?.label || 'Projet inconnu';
    const code = prjObj?.code_projet || rows.find((r) => r.id === pId)?.code || null;
    const refExt = prjObj?.reference_externe || rows.find((r) => r.id === pId)?.reference_externe || null;

    const teamIds = Array.from(pData.teamsMap.keys());
    const initial = sumChiffresForTeamIds(dataset, teamIds, pId, 'initial') ?? prjObj?.chiffrage_initial ?? 0;
    const revise = sumChiffresForTeamIds(dataset, teamIds, pId, 'revise') ?? prjObj?.chiffrage_revise ?? 0;
    const previsionnel = sumChiffresForTeamIds(dataset, teamIds, pId, 'previsionnel') ?? prjObj?.chiffrage_previsionnel ?? 0;
    const consomme = sumChiffresForTeamIds(dataset, teamIds, pId, 'consomme') ?? prjObj?.temps_consomme ?? 0;
    const restant = sumChiffresForTeamIds(dataset, teamIds, pId, 'restant') ?? Math.max(0, revise - consomme);

    const chiffres: PlanExportChiffres = {
      initial: Math.round(initial * 100) / 100,
      revise: Math.round(revise * 100) / 100,
      previsionnel: Math.round(previsionnel * 100) / 100,
      consomme: Math.round(consomme * 100) / 100,
      restant: Math.round(restant * 100) / 100,
    };

    const jalons: PlanExportJalon[] = (dataset.allJalons || [])
      .filter((j) => j.projet_id === pId)
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
      .map((j) => ({
        id: j.id,
        titre: j.title,
        type: j.event_type,
        date: j.event_date,
        description: j.description || undefined,
      }));

    const projectWeeklyCharges: Record<string, number> = {};
    let projectTotalDays = 0;
    const equipes: PlanExportProjetEquipe[] = [];

    pData.teamsMap.forEach((tData, tId) => {
      const tmObj = dataset.allEquipes.find((e) => e.id === tId);
      const teamWeeklyCharges: Record<string, number> = {};
      let teamTotalDays = 0;
      const ressources: PlanExportRessource[] = Array.from(tData.resourcesMap.values());

      for (const res of ressources) {
        teamTotalDays += res.totalJoursPlanifies;
        Object.entries(res.chargesParSemaine).forEach(([wKey, val]) => {
          teamWeeklyCharges[wKey] = Math.round(((teamWeeklyCharges[wKey] || 0) + val) * 100) / 100;
          projectWeeklyCharges[wKey] = Math.round(((projectWeeklyCharges[wKey] || 0) + val) * 100) / 100;
        });
      }

      projectTotalDays += teamTotalDays;

      equipes.push({
        id: tId,
        nom: tmObj?.nom || tId,
        code: tmObj?.code || null,
        couleur: tmObj?.color || null,
        totalJoursPlanifies: Math.round(teamTotalDays * 100) / 100,
        chargesParSemaine: teamWeeklyCharges,
        ressources,
      });
    });

    equipes.sort((a, b) => a.nom.localeCompare(b.nom));
    totalJoursPlanifiesGlobal += projectTotalDays;

    projets.push({
      id: pId,
      code,
      referenceExterne: refExt,
      nom,
      statut: prjObj?.statut || null,
      chefProjet: prjObj?.chef_projet || null,
      couleur: prjObj?.color || null,
      rang: prjObj?.rank || null,
      chiffres,
      jalons,
      totalJoursPlanifies: Math.round(projectTotalDays * 100) / 100,
      chargesParSemaine: projectWeeklyCharges,
      equipes,
    });
  });

  projets.sort((a, b) => a.nom.localeCompare(b.nom));

  // 3. Nœud "equipes"
  const equipesNode: PlanExportEquipe[] = [];

  teamMap.forEach((tData, tId) => {
    const tmObj = dataset.allEquipes.find((e) => e.id === tId);
    const nom = tmObj?.nom || tId;
    const teamWeeklyCharges: Record<string, number> = {};
    let teamTotalDays = 0;
    const teamProjets: PlanExportEquipeProjet[] = [];

    tData.projectsMap.forEach((pData, pId) => {
      const prjObj = dataset.allProjects.find((p) => p.id === pId);
      const prjWeeklyCharges: Record<string, number> = {};
      let prjTotalDays = 0;
      const ressources: PlanExportRessource[] = Array.from(pData.resourcesMap.values());

      for (const res of ressources) {
        prjTotalDays += res.totalJoursPlanifies;
        Object.entries(res.chargesParSemaine).forEach(([wKey, val]) => {
          prjWeeklyCharges[wKey] = Math.round(((prjWeeklyCharges[wKey] || 0) + val) * 100) / 100;
          teamWeeklyCharges[wKey] = Math.round(((teamWeeklyCharges[wKey] || 0) + val) * 100) / 100;
        });
      }

      teamTotalDays += prjTotalDays;

      teamProjets.push({
        id: pId,
        nom: prjObj?.nom_projet || pId,
        code: prjObj?.code_projet || null,
        referenceExterne: prjObj?.reference_externe || null,
        statut: prjObj?.statut || null,
        totalJoursPlanifies: Math.round(prjTotalDays * 100) / 100,
        chargesParSemaine: prjWeeklyCharges,
        ressources,
      });
    });

    teamProjets.sort((a, b) => a.nom.localeCompare(b.nom));

    equipesNode.push({
      id: tId,
      nom,
      code: tmObj?.code || null,
      couleur: tmObj?.color || null,
      totalJoursPlanifies: Math.round(teamTotalDays * 100) / 100,
      chargesParSemaine: teamWeeklyCharges,
      metriquesHebdomadaires: tData.metrics && Object.keys(tData.metrics).length > 0 ? tData.metrics : undefined,
      projets: teamProjets,
    });
  });

  equipesNode.sort((a, b) => a.nom.localeCompare(b.nom));

  // 4. Synthèse globale
  const synthese: PlanExportSynthese = {
    totalJoursPlanifies: Math.round(totalJoursPlanifiesGlobal * 100) / 100,
    nombreProjets: projets.length,
    nombreEquipes: equipesNode.length,
    nombreRessources: allUniqueResourceIds.size,
    totauxParSemaine: globalWeeklyTotals,
  };

  // 5. Arborescence exacte affichée à l'écran
  const arborescenceVue: PlanExportArborescence = {
    mode: viewMode,
    lignes: rows.map((parent) => {
      const parentCharges: Record<string, number> = {};
      let parentTotal = 0;

      for (const wKey of displayedWeekKeys) {
        const val = parent.totalCharges?.get(wKey) || 0;
        if (val > 0) {
          const rounded = Math.round(val * 100) / 100;
          parentCharges[wKey] = rounded;
          parentTotal += rounded;
        }
      }

      return {
        id: parent.id,
        libelle: parent.label,
        code: parent.code || null,
        referenceExterne: parent.reference_externe || null,
        couleur: parent.color || null,
        totalJoursPlanifies: Math.round(parentTotal * 100) / 100,
        chargesParSemaine: parentCharges,
        enfants: parent.children.map((child) => {
          const childCharges: Record<string, number> = {};
          let childTotal = 0;

          for (const wKey of displayedWeekKeys) {
            const val = child.charges?.get(wKey) || 0;
            if (val > 0) {
              const rounded = Math.round(val * 100) / 100;
              childCharges[wKey] = rounded;
              childTotal += rounded;
            }
          }

          return {
            id: child.id,
            libelle: child.label,
            code: child.code || null,
            totalJoursPlanifies: Math.round(childTotal * 100) / 100,
            chargesParSemaine: childCharges,
            ressources: child.resources.map((res) => {
              const resCharges: Record<string, number> = {};
              const resComments: Record<string, string> = {};
              let resTotal = 0;

              for (const wKey of displayedWeekKeys) {
                const val = res.charges?.get(wKey) || 0;
                const comment = res.comments?.get(wKey);

                if (val > 0) {
                  const rounded = Math.round(val * 100) / 100;
                  resCharges[wKey] = rounded;
                  resTotal += rounded;
                }

                if (comment) {
                  resComments[wKey] = comment;
                }
              }

              return {
                id: res.id,
                libelle: res.label,
                type: res.type,
                totalJoursPlanifies: Math.round(resTotal * 100) / 100,
                chargesParSemaine: resCharges,
                commentaires: Object.keys(resComments).length > 0 ? resComments : undefined,
              };
            }),
          };
        }),
      };
    }),
  };

  return {
    metadonnees,
    synthese,
    projets,
    equipes: equipesNode,
    arborescenceVue,
  };
}

/**
 * Déclenche le téléchargement d'un payload JSON dans le navigateur.
 */
export function downloadPlanAsJson(data: unknown, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Point d'entrée pour l'export JSON de la planification.
 */
export function exportPlanToJson(params: PlanJsonExportParams): void {
  const data = buildPlanJsonExport(params);
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  downloadPlanAsJson(data, `planification_${dateStr}.json`);
}
