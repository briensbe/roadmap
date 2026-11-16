import {
  buildPlanJsonExport,
  PlanJsonExportParams,
} from './plan-json-exporter';
import { ParentRow, PlanRawDataset, PlanFilterCriteria } from './plan-view.models';

describe('PlanJsonExporter', () => {
  const mockDataset: PlanRawDataset = {
    allProjects: [
      {
        id: 'p1',
        id_projet: 1,
        nom_projet: 'Projet Alpha',
        code_projet: 'ALPHA',
        reference_externe: 'JIRA-100',
        statut: 'En cours',
        chef_projet: 'Bob',
        color: '#3b82f6',
        rank: '0|hzzzzz:',
        chiffrage_initial: 100,
        chiffrage_revise: 120,
        chiffrage_previsionnel: 110,
        temps_consomme: 30,
      },
    ],
    allEquipes: [
      { id: 'e1', nom: 'Équipe Frontend', code: 'FRONT', color: '#10b981' },
    ],
    allCharges: [],
    availableRoles: [{ id: 'r1', nom: 'Développeur Angular', jours_par_semaine: 5 }],
    availablePersonnes: [
      { id: 'pers1', nom: 'Martin', prenom: 'Alice', jours_par_semaine: 5, equipe_id: 'e1' },
    ],
    allJalons: [
      {
        id: 'j1',
        projet_id: 'p1',
        title: 'Mise en prod',
        event_type: 'LV',
        event_date: '2026-06-15',
        description: 'Livraison v1',
      },
    ],
    allLinks: [],
    allRoleAttachments: [],
    allCapacities: [],
    allChiffres: [],
    allServices: [],
    capacityIndex: new Map(),
    usageMap: new Map(),
  };

  const mockWeeks = [
    new Date(2026, 0, 5), // 2026-01-05
    new Date(2026, 0, 12), // 2026-01-12
  ];

  const defaultCriteria: PlanFilterCriteria = {
    viewMode: 'project',
    globalSearch: '',
    filterEquipeIds: [],
    filterProjetIds: [],
    filterResourceIds: [],
    filterStatusIds: [],
    filterPeriodEnabled: false,
    effectivePeriodStart: '',
    effectivePeriodEnd: '',
    filterSizeEnabled: false,
    filterSizeCriterion: 'charges_all',
    filterSizeOperator: 'gte',
    filterSizeValue: null,
    weekFilters: [],
    chiffreMode: 'revise',
  };

  it('devrait exporter une structure valide avec métadonnées et synthèse pour une vue vide', () => {
    const params: PlanJsonExportParams = {
      rows: [],
      dataset: mockDataset,
      displayedWeeks: mockWeeks,
      viewMode: 'project',
      criteria: defaultCriteria,
      chiffreMode: 'revise',
    };

    const result = buildPlanJsonExport(params);

    expect(result.metadonnees).toBeDefined();
    expect(result.metadonnees.modeVue).toBe('project');
    expect(result.metadonnees.periode.nombreSemaines).toBe(2);
    expect(result.metadonnees.periode.semaines).toEqual(['2026-01-05', '2026-01-12']);
    expect(result.synthese.totalJoursPlanifies).toBe(0);
    expect(result.synthese.nombreProjets).toBe(0);
    expect(result.projets).toEqual([]);
    expect(result.equipes).toEqual([]);
    expect(result.arborescenceVue.lignes).toEqual([]);
  });

  it('devrait compiler les informations de projets, équipes, ressources, jalons et charges', () => {
    const chargesMap = new Map<string, number>();
    chargesMap.set('2026-01-05', 3.5);
    chargesMap.set('2026-01-12', 2);

    const commentsMap = new Map<string, string>();
    commentsMap.set('2026-01-05', 'Début sprint');

    const filteredRows: ParentRow[] = [
      {
        id: 'p1',
        label: 'Projet Alpha',
        code: 'ALPHA',
        reference_externe: 'JIRA-100',
        expanded: true,
        totalCharges: chargesMap,
        originalProject: mockDataset.allProjects[0],
        children: [
          {
            id: 'e1',
            label: 'Équipe Frontend',
            expanded: true,
            charges: chargesMap,
            resources: [
              {
                id: 'pers1',
                uniqueId: 'e1_personne_pers1_p1',
                label: 'Alice Martin',
                type: 'personne',
                jours_par_semaine: 5,
                charges: chargesMap,
                comments: commentsMap,
              },
            ],
          },
        ],
      },
    ];

    const params: PlanJsonExportParams = {
      rows: filteredRows,
      dataset: mockDataset,
      displayedWeeks: mockWeeks,
      viewMode: 'project',
      criteria: defaultCriteria,
      chiffreMode: 'revise',
    };

    const result = buildPlanJsonExport(params);

    // Synthèse
    expect(result.synthese.totalJoursPlanifies).toBe(5.5);
    expect(result.synthese.nombreProjets).toBe(1);
    expect(result.synthese.nombreEquipes).toBe(1);
    expect(result.synthese.nombreRessources).toBe(1);
    expect(result.synthese.totauxParSemaine['2026-01-05']).toBe(3.5);
    expect(result.synthese.totauxParSemaine['2026-01-12']).toBe(2);

    // Nœud "projets"
    expect(result.projets.length).toBe(1);
    const prj = result.projets[0];
    expect(prj.id).toBe('p1');
    expect(prj.nom).toBe('Projet Alpha');
    expect(prj.code).toBe('ALPHA');
    expect(prj.referenceExterne).toBe('JIRA-100');
    expect(prj.chiffres.revise).toBe(120);
    expect(prj.chiffres.consomme).toBe(30);
    expect(prj.jalons.length).toBe(1);
    expect(prj.jalons[0].titre).toBe('Mise en prod');
    expect(prj.totalJoursPlanifies).toBe(5.5);
    expect(prj.equipes.length).toBe(1);

    const eq = prj.equipes[0];
    expect(eq.id).toBe('e1');
    expect(eq.nom).toBe('Équipe Frontend');
    expect(eq.totalJoursPlanifies).toBe(5.5);
    expect(eq.ressources.length).toBe(1);

    const res = eq.ressources[0];
    expect(res.id).toBe('pers1');
    expect(res.nom).toBe('Alice Martin');
    expect(res.totalJoursPlanifies).toBe(5.5);
    expect(res.planifications.length).toBe(2);
    expect(res.planifications[0]).toEqual({
      semaine: '2026-01-05',
      jours: 3.5,
      commentaire: 'Début sprint',
    });

    // Nœud "equipes"
    expect(result.equipes.length).toBe(1);
    expect(result.equipes[0].nom).toBe('Équipe Frontend');
    expect(result.equipes[0].projets.length).toBe(1);
    expect(result.equipes[0].projets[0].nom).toBe('Projet Alpha');

    // Nœud "arborescenceVue"
    expect(result.arborescenceVue.mode).toBe('project');
    expect(result.arborescenceVue.lignes.length).toBe(1);
    expect(result.arborescenceVue.lignes[0].libelle).toBe('Projet Alpha');
  });

  it('devrait inclure le détail des filtres appliqués dans les métadonnées', () => {
    const criteriaWithFilters: PlanFilterCriteria = {
      ...defaultCriteria,
      globalSearch: 'Alpha',
      filterEquipeIds: ['e1'],
      filterProjetIds: ['p1'],
      filterStatusIds: ['En cours'],
      filterPeriodEnabled: true,
      effectivePeriodStart: '2026-01-01',
      effectivePeriodEnd: '2026-06-30',
      filterSizeEnabled: true,
      filterSizeCriterion: 'charges_all',
      filterSizeOperator: 'gte',
      filterSizeValue: 10,
    };

    const params: PlanJsonExportParams = {
      rows: [],
      dataset: mockDataset,
      displayedWeeks: mockWeeks,
      viewMode: 'project',
      criteria: criteriaWithFilters,
      chiffreMode: 'revise',
    };

    const result = buildPlanJsonExport(params);

    expect(result.metadonnees.filtresAppliques.rechercheGlobale).toBe('Alpha');
    expect(result.metadonnees.filtresAppliques.equipes).toEqual(['Équipe Frontend']);
    expect(result.metadonnees.filtresAppliques.projets).toEqual(['Projet Alpha']);
    expect(result.metadonnees.filtresAppliques.statuts).toEqual(['En cours']);
    expect(result.metadonnees.filtresAppliques.filtrePeriode.actif).toBeTrue();
    expect(result.metadonnees.filtresAppliques.filtrePeriode.debut).toBe('2026-01-01');
    expect(result.metadonnees.filtresAppliques.filtreTaille.actif).toBeTrue();
    expect(result.metadonnees.filtresAppliques.filtreTaille.valeur).toBe(10);
  });
});
