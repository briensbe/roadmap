import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProjectsViewComponent } from './projects-view.component';
import { ProjetService } from '../../services/projet.service';
import { SettingsService } from '../../services/settings.service';
import { PermissionService } from '../../services/permission.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { Projet } from '../../models/types';

describe('ProjectsViewComponent - Permissions & Guards', () => {
  let component: ProjectsViewComponent;
  let fixture: ComponentFixture<ProjectsViewComponent>;
  let permissionServiceSpy: jasmine.SpyObj<PermissionService>;
  let projetServiceSpy: jasmine.SpyObj<ProjetService>;
  let settingsServiceSpy: jasmine.SpyObj<SettingsService>;

  const fakeProjet: Projet = {
    id: 'p1',
    id_projet: 1,
    code_projet: 'PROJ-1',
    nom_projet: 'Projet Test',
    statut: 'En cours',
    description: '',
    temps_consomme: 0,
    chiffrage_previsionnel: 10,
    reference_externe: '',
    color: '#3b82f6',
  };

  beforeEach(async () => {
    permissionServiceSpy = jasmine.createSpyObj('PermissionService', ['ensureCanEdit'], {
      canEdit: signal(true),
      isViewer: signal(false),
      userRole: signal('editor'),
    });
    permissionServiceSpy.ensureCanEdit.and.returnValue(true);

    projetServiceSpy = jasmine.createSpyObj('ProjetService', [
      'getAllProjetsQuery',
      'createProjetMutation',
      'updateProjetMutation',
      'deleteProjetMutation',
      'calculateRAF',
      'deleteProjet',
      'createProjet',
    ]);
    projetServiceSpy.getAllProjetsQuery.and.returnValue({ data: signal([fakeProjet]) } as any);
    projetServiceSpy.createProjetMutation.and.returnValue({ mutate: jasmine.createSpy() } as any);
    projetServiceSpy.updateProjetMutation.and.returnValue({ mutate: jasmine.createSpy() } as any);
    projetServiceSpy.deleteProjetMutation.and.returnValue({ mutate: jasmine.createSpy() } as any);
    projetServiceSpy.calculateRAF.and.returnValue(10);

    settingsServiceSpy = jasmine.createSpyObj('SettingsService', ['getSettingQuery']);
    settingsServiceSpy.getSettingQuery.and.returnValue({ data: signal(null) } as any);

    await TestBed.configureTestingModule({
      imports: [ProjectsViewComponent],
      providers: [
        { provide: PermissionService, useValue: permissionServiceSpy },
        { provide: ProjetService, useValue: projetServiceSpy },
        { provide: SettingsService, useValue: settingsServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            snapshot: { queryParams: {} },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsViewComponent);
    component = fixture.componentInstance;
  });

  it('should create ProjectsViewComponent', () => {
    expect(component).toBeTruthy();
  });

  describe('Viewer permission guards', () => {
    beforeEach(() => {
      permissionServiceSpy.ensureCanEdit.and.returnValue(false);
    });

    it('should block openCreateModal when ensureCanEdit returns false', () => {
      component.openCreateModal();
      expect(component.showProjectModal).toBeFalse();
    });

    it('should block openEditModal when ensureCanEdit returns false', () => {
      component.openEditModal(fakeProjet);
      expect(component.showProjectModal).toBeFalse();
    });

    it('should block duplicateProjet when ensureCanEdit returns false', () => {
      component.duplicateProjet(fakeProjet);
      expect(component.showProjectModal).toBeFalse();
    });

    it('should block deleteProjet when ensureCanEdit returns false', () => {
      component.deleteProjet(fakeProjet);
      expect(component.showConfirmModal).toBeFalse();
    });

    it('should block triggerImport when ensureCanEdit returns false', () => {
      component.triggerImport();
      // Should not throw and ensureCanEdit was checked
      expect(permissionServiceSpy.ensureCanEdit).toHaveBeenCalled();
    });

    it('should block drop rank update when ensureCanEdit returns false', async () => {
      await component.drop({ previousIndex: 0, currentIndex: 1 } as any);
      const updateMutation = projetServiceSpy.updateProjetMutation();
      expect(updateMutation.mutate).not.toHaveBeenCalled();
    });
  });
});
