import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanViewComponent } from './plan-view.component';
import { TeamService } from '../../services/team.service';
import { ProjetService } from '../../services/projet.service';
import { ChargeService } from '../../services/charge.service';
import { RolesService } from '../../services/roles.service';
import { CalendarService } from '../../services/calendar.service';
import { JalonService } from '../../services/jalon.service';
import { SettingsService } from '../../services/settings.service';
import { PersonnesService } from '../../services/personnes.service';
import { ChiffresService } from '../../services/chiffres.service';
import { ResourceService } from '../../services/resource.service';
import { CrewdayzIntegrationService } from '../../services/crewdayz-integration.service';
import { ThemeService } from '../../services/theme.service';
import { signal } from '@angular/core';

describe('PlanViewComponent - Vue Par Service', () => {
  let component: PlanViewComponent;
  let fixture: ComponentFixture<PlanViewComponent>;

  const week1 = '2026-03-02';
  const week1Date = new Date(2026, 2, 2);

  beforeEach(async () => {
    const teamServiceSpy = jasmine.createSpyObj('TeamService', [
      'getAllEquipes',
      'getAllCapacities',
      'getEquipeResources',
      'removeRoleFromEquipe',
      'removePersonneFromEquipe',
    ]);
    const projetServiceSpy = jasmine.createSpyObj('ProjetService', [
      'getAllProjets',
      'getAllEquipeProjetLinks',
      'updateProjet',
      'linkProjectToTeam',
      'unlinkProjectFromTeam',
    ]);
    const chargeServiceSpy = jasmine.createSpyObj('ChargeService', [
      'getAllCharges',
      'createOrUpdateCharge',
      'createChargeWithoutDates',
      'getChargesByProject',
      'deleteChargesForResource',
      'deleteChargesForProjectTeam',
      'bulkMoveCharges',
      'getAvailableRolesForProjectTeam',
      'getAvailablePersonnesForProjectTeam',
    ]);
    const rolesServiceSpy = jasmine.createSpyObj('RolesService', ['getAllRoles', 'getAllRoleAttachments']);
    const jalonServiceSpy = jasmine.createSpyObj('JalonService', ['getAllJalons']);
    const settingsServiceSpy = jasmine.createSpyObj('SettingsService', ['getSettingQuery']);
    settingsServiceSpy.getSettingQuery.and.returnValue({ data: signal(null) });
    const personnesServiceSpy = jasmine.createSpyObj('PersonnesService', ['getAllPersonnes']);
    const chiffresServiceSpy = jasmine.createSpyObj('ChiffresService', ['getAllChiffres']);
    const resourceServiceSpy = jasmine.createSpyObj('ResourceService', ['getAllServices']);
    const crewdayzServiceSpy = jasmine.createSpyObj('CrewdayzIntegrationService', [
      'getCapacitySourceConfigs',
      'getSourceForTeam',
      'getMappings',
      'getAvailabilities',
      'calculateAvailableCount',
      'getEffectiveCapacity',
    ]);
    const themeServiceSpy = jasmine.createSpyObj('ThemeService', ['isDarkMode']);
    themeServiceSpy.isDarkMode.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [PlanViewComponent],
      providers: [
        { provide: TeamService, useValue: teamServiceSpy },
        { provide: ProjetService, useValue: projetServiceSpy },
        { provide: ChargeService, useValue: chargeServiceSpy },
        { provide: RolesService, useValue: rolesServiceSpy },
        CalendarService,
        { provide: JalonService, useValue: jalonServiceSpy },
        { provide: SettingsService, useValue: settingsServiceSpy },
        { provide: PersonnesService, useValue: personnesServiceSpy },
        { provide: ChiffresService, useValue: chiffresServiceSpy },
        { provide: ResourceService, useValue: resourceServiceSpy },
        { provide: CrewdayzIntegrationService, useValue: crewdayzServiceSpy },
        { provide: ThemeService, useValue: themeServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanViewComponent);
    component = fixture.componentInstance;

    // Reset filters and setup base data
    component.filterEquipeIds.set([]);
    component.filterProjetIds.set([]);
    component.filterResourceIds.set([]);
    component.filterStatusIds.set([]);
    component.filterPeriodEnabled.set(false);
    component.filterSizeEnabled.set(false);
    component.weekFilters.set([]);
    component.globalSearch.set('');
    component.selectedCapacityYear.set('all');

    component.displayedWeeks = [week1Date];
    component.allServices = [
      { id: 'srv-dev', nom: 'Développement', departement_id: 'dep-1' },
      { id: 'srv-arch', nom: 'Architecture', departement_id: 'dep-1' },
      { id: 'srv-empty', nom: 'Support Vide', departement_id: 'dep-1' },
    ];
    component.allEquipes = [
      // Deliberately assign Equipe.service_id to srv-empty to verify it is NEVER used as fallback
      { id: 'team-1', nom: 'Squad Alpha', departement_id: 'dep-1', service_id: 'srv-empty' },
      { id: 'team-2', nom: 'Squad Beta', departement_id: 'dep-1', service_id: 'srv-empty' },
    ];
    component.availableRoles = [
      { id: 'role-back', nom: 'Dev Backend', jours_par_semaine: 5 },
      { id: 'role-unassigned', nom: 'Role Sans Service', jours_par_semaine: 5 },
    ];
    component.allRoleAttachments = [
      // Attachment in ResourceManager carrying service_id
      { id: 'att-global', role_id: 'role-back', service_id: 'srv-dev' },
      // Attachment in team-1 with null service_id (as created by addRoleToEquipe)
      { id: 'att-t1', role_id: 'role-back', equipe_id: 'team-1', service_id: null },
      // Attachment in team-2 with explicit service_id
      { id: 'att-t2', role_id: 'role-back', equipe_id: 'team-2', service_id: 'srv-dev' },
      // Unassigned role attached to team-1 (whose equipe has service_id = srv-empty)
      { id: 'att-unassigned', role_id: 'role-unassigned', equipe_id: 'team-1', service_id: null },
    ];
    component.availablePersonnes = [
      {
        id: 'pers-1',
        nom: 'Dupont',
        prenom: 'Alice',
        jours_par_semaine: 4, // 4 days/week regime
        equipe_id: 'team-1',
        service_id: 'srv-dev',
      },
      {
        id: 'pers-arch',
        nom: 'Martin',
        prenom: 'Bob',
        jours_par_semaine: 5,
        equipe_id: 'team-2',
        service_id: 'srv-arch',
      },
    ];
    component.allProjects = [
      {
        id: 'proj-1',
        id_projet: 1,
        code_projet: 'PRJ-01',
        nom_projet: 'Refonte Portail',
        statut: 'En cours',
        chiffrage_initial: 80,
        chiffrage_revise: 90,
        chiffrage_previsionnel: 100,
        temps_consomme: 35,
      },
      {
        id: 'proj-2',
        id_projet: 2,
        code_projet: 'PRJ-02',
        nom_projet: 'Migration Cloud',
        statut: 'Actif',
        chiffrage_initial: 50,
        chiffrage_revise: 50,
        chiffrage_previsionnel: 50,
        temps_consomme: 10,
      },
    ];
    component.allCharges = [
      // Squad Alpha: role-back (5d/w) -> 2 ETP on proj-1 => 10d
      {
        id: 'ch-1',
        projet_id: 'proj-1',
        equipe_id: 'team-1',
        role_id: 'role-back',
        unite_ressource: 2,
        jours_par_semaine: 5,
        semaine_debut: week1,
        semaine_fin: week1,
        comment: ' API Core ',
      },
      // Squad Alpha: pers-1 (4d/w) -> 0.5 ETP on proj-1 => 2d
      {
        id: 'ch-2',
        projet_id: 'proj-1',
        equipe_id: 'team-1',
        personne_id: 'pers-1',
        unite_ressource: 0.5,
        jours_par_semaine: 4,
        semaine_debut: week1,
        semaine_fin: week1,
      },
      // Squad Beta: role-back (5d/w) -> 1 ETP on proj-1 => 5d
      {
        id: 'ch-3',
        projet_id: 'proj-1',
        equipe_id: 'team-2',
        role_id: 'role-back',
        unite_ressource: 1,
        jours_par_semaine: 5,
        semaine_debut: week1,
        semaine_fin: week1,
      },
      // Unassigned role in team-1 (must NOT be attached to srv-empty even though team-1.service_id === 'srv-empty')
      {
        id: 'ch-4',
        projet_id: 'proj-2',
        equipe_id: 'team-1',
        role_id: 'role-unassigned',
        unite_ressource: 3,
        jours_par_semaine: 5,
        semaine_debut: week1,
        semaine_fin: week1,
      },
    ];

    // Populate capacityIndex
    const capIndex = component.capacityIndex;
    capIndex.clear();
    capIndex.set(`team-1_role_role-back_${week1}`, 3);
    capIndex.set(`team-1_personne_pers-1_${week1}`, 1);
    capIndex.set(`team-2_role_role-back_${week1}`, 2);
    capIndex.set(`team-2_personne_pers-arch_${week1}`, 1.5);
  });

  it('should strictly resolve service_id from role_attachments or personne and never fallback to equipe.service_id', () => {
    expect(component.getResourceServiceId('role', 'role-back', 'team-1')).toBe('srv-dev');
    expect(component.getResourceServiceId('role', 'role-back', 'team-2')).toBe('srv-dev');
    expect(component.getResourceServiceId('personne', 'pers-1', 'team-1')).toBe('srv-dev');
    expect(component.getResourceServiceId('role', 'role-unassigned', 'team-1')).toBeNull();
  });

  it('should display all services sorted alphabetically and consolidate project charges, exact days, and X/Y (+/- delta)', () => {
    component.switchViewMode('service');

    // All 3 services displayed, sorted alphabetically
    expect(component.rows.map((r) => r.id)).toEqual(['srv-arch', 'srv-dev', 'srv-empty']);

    // 1. Architecture: no planned charges (X = 0), capacity Y = 1.5 -> delta = +1.5 (positive)
    const archRow = component.rows.find((r) => r.id === 'srv-arch')!;
    expect(archRow.children[0].resources.length).toBe(0);
    const archMetrics = archRow.metrics?.get(week1);
    expect(archMetrics).toEqual({
      total: 0,
      capacity: 1.5,
      availability: 1.5,
      status: 'positive',
    });

    // 2. Support Vide: unassigned role in team-1 must NOT leak into srv-empty via equipe.service_id
    const emptyRow = component.rows.find((r) => r.id === 'srv-empty')!;
    expect(emptyRow.children[0].resources.length).toBe(0);
    expect(emptyRow.metrics?.get(week1)?.total).toBe(0);

    // 3. Développement: X = 2 + 0.5 + 1 = 3.5 ETP, Y = 3 + 1 + 2 = 6 ETP -> delta = +2.5
    const devRow = component.rows.find((r) => r.id === 'srv-dev')!;
    const devMetrics = devRow.metrics?.get(week1);
    expect(devMetrics).toEqual({
      total: 3.5,
      capacity: 6,
      availability: 2.5,
      status: 'positive',
    });

    // Project leaf row under Développement
    const devProjects = devRow.children[0].resources;
    expect(devProjects.length).toBe(1);
    const proj1Row = devProjects[0];
    expect(proj1Row.id).toBe('proj-1');
    expect(proj1Row.charges.get(week1)).toBe(3.5);

    // Exact planned days: (2 * 5) + (0.5 * 4) + (1 * 5) = 10 + 2 + 5 = 17 days
    expect(proj1Row.dailyCharges?.get(week1)).toBe(17);
    expect(component.getResourceTotalPlannedDays(proj1Row)).toBe(17);
    expect(component.getPlannedDaysForResource(proj1Row, 'all')).toBe(17);
    expect(component.getResourceMetricsYear(proj1Row, 2026)).toBe(17);

    // Leaf cell data must NOT show availability or capacity record coloring
    const cell0 = proj1Row.cellData?.[0];
    expect(cell0?.value).toBe(3.5);
    expect(cell0?.showAvailability).toBeFalse();
    expect(cell0?.hasCapRecord).toBeFalse();
  });

  it('should recalculate consolidated X and Y when Equipes filter is active in service view', () => {
    component.switchViewMode('service');

    // Filter only Squad Alpha (team-1)
    component.filterEquipeIds.set(['team-1']);
    component.buildTree();

    const devRow = component.rows.find((r) => r.id === 'srv-dev')!;
    // In team-1: X = 2 + 0.5 = 2.5 ETP, Y = 3 + 1 = 4 ETP -> delta = +1.5
    expect(devRow.metrics?.get(week1)).toEqual({
      total: 2.5,
      capacity: 4,
      availability: 1.5,
      status: 'positive',
    });

    const proj1Row = devRow.children[0].resources[0];
    expect(proj1Row.charges.get(week1)).toBe(2.5);
    // Exact days in team-1: (2 * 5) + (0.5 * 4) = 12 days
    expect(component.getResourceTotalPlannedDays(proj1Row)).toBe(12);
  });

  it('should resolve Chiffres directly for (serviceId, projectId) in service mode', () => {
    component.allChiffres = [
      {
        id_chiffres: 1,
        id_projet: 'proj-1',
        id_service: 'srv-dev',
        initial: 80,
        revise: 90,
        previsionnel: 100,
        consomme: 35,
      },
    ];
    component.switchViewMode('service');

    expect(component.getChiffreValueForServiceProject('srv-dev', 'proj-1', 'initial')).toBe(80);
    expect(component.getChiffreValueForServiceProject('srv-dev', 'proj-1', 'restant')).toBe(65);
    expect(component.getChiffreValueForServiceProject('srv-arch', 'proj-1', 'previsionnel')).toBeNull();
  });

  it('should clear selection when switching to service view', () => {
    component.selectedCells = [{ resource: {} as any, week: new Date(), childId: 'c1', parentId: 'p1' }];
    component.switchViewMode('service');
    expect(component.selectedCells.length).toBe(0);
  });
});
