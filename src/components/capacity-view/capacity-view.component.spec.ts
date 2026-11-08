import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CapacityViewComponent } from './capacity-view.component';
import { CapacityDataRepository } from './capacity-data.repository';
import { CapacityBulkActionsService } from './capacity-bulk-actions.service';
import { ToastService } from '../../services/toast.service';
import { PermissionService } from '../../services/permission.service';
import { signal } from '@angular/core';
import { TeamRow, ResourceRow, SelectedCapacityCell } from './capacity-view.models';
import { Equipe } from '../../models/types';

describe('CapacityViewComponent - Permissions & Guards', () => {
  let component: CapacityViewComponent;
  let fixture: ComponentFixture<CapacityViewComponent>;
  let permissionServiceSpy: jasmine.SpyObj<PermissionService>;
  let bulkActionsSpy: jasmine.SpyObj<CapacityBulkActionsService>;
  let repoSpy: jasmine.SpyObj<CapacityDataRepository>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    permissionServiceSpy = jasmine.createSpyObj('PermissionService', ['ensureCanEdit'], {
      canEdit: signal(true),
      isViewer: signal(false),
      userRole: signal('editor'),
    });
    permissionServiceSpy.ensureCanEdit.and.returnValue(true);

    bulkActionsSpy = jasmine.createSpyObj('CapacityBulkActionsService', [
      'applyBulkCapacite',
      'applyBulkOverride',
      'applyBulkDelta',
      'applyClearCustomizations',
      'applyCapacityProjection',
    ]);

    repoSpy = jasmine.createSpyObj('CapacityDataRepository', [
      'loadAllEquipes',
      'loadAllCapacities',
      'loadAllRoles',
      'loadCrewdayzConfigs',
      'loadAvailableResourcesForEquipe',
      'addResourceToEquipe',
      'removeResourceFromEquipe',
    ]);
    repoSpy.loadAllEquipes.and.resolveTo([]);
    repoSpy.loadAllCapacities.and.resolveTo([]);
    repoSpy.loadAllRoles.and.resolveTo([]);
    repoSpy.loadCrewdayzConfigs.and.resolveTo([]);

    toastSpy = jasmine.createSpyObj('ToastService', ['info', 'warning', 'error']);

    await TestBed.configureTestingModule({
      imports: [CapacityViewComponent],
      providers: [
        { provide: PermissionService, useValue: permissionServiceSpy },
        { provide: CapacityBulkActionsService, useValue: bulkActionsSpy },
        { provide: CapacityDataRepository, useValue: repoSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CapacityViewComponent);
    component = fixture.componentInstance;
    component.selectedTeamIds.set([]);
  });

  it('should create CapacityViewComponent', () => {
    expect(component).toBeTruthy();
  });

  describe('Viewer permission guards on bulk actions', () => {
    beforeEach(() => {
      permissionServiceSpy.ensureCanEdit.and.returnValue(false);
      // Simuler une cellule sélectionnée
      component.selectionCtrl.selectedCells = [
        {
          resource: { id: 'r1', label: 'Dev', type: 'role' } as ResourceRow,
          week: new Date(),
          equipeId: 'eq-1',
        } as SelectedCapacityCell,
      ];
    });

    it('should block applyBulkCapacite when ensureCanEdit returns false', async () => {
      await component.applyBulkCapacite(5);
      expect(bulkActionsSpy.applyBulkCapacite).not.toHaveBeenCalled();
    });

    it('should block applyBulkOverride when ensureCanEdit returns false', async () => {
      await component.applyBulkOverride({ value: 4 });
      expect(bulkActionsSpy.applyBulkOverride).not.toHaveBeenCalled();
    });

    it('should block applyBulkDelta when ensureCanEdit returns false', async () => {
      await component.applyBulkDelta({ delta: 1 });
      expect(bulkActionsSpy.applyBulkDelta).not.toHaveBeenCalled();
    });

    it('should block applyClearCustomizations when ensureCanEdit returns false', async () => {
      await component.applyClearCustomizations();
      expect(bulkActionsSpy.applyClearCustomizations).not.toHaveBeenCalled();
    });

    it('should block applyCapacityProjection when ensureCanEdit returns false', async () => {
      await component.applyCapacityProjection({ resources: 1, totalDays: 10 });
      expect(bulkActionsSpy.applyCapacityProjection).not.toHaveBeenCalled();
    });
  });

  describe('Viewer permission guards on resource actions', () => {
    it('should block openAddResourceModal when ensureCanEdit returns false', async () => {
      permissionServiceSpy.ensureCanEdit.and.returnValue(false);
      const fakeEquipe: Equipe = { id: 'eq-1', nom: 'Team Alpha' };
      await component.openAddResourceModal(fakeEquipe);

      expect(component.showAddResourceModal).toBeFalse();
      expect(repoSpy.loadAvailableResourcesForEquipe).not.toHaveBeenCalled();
    });

    it('should block removeResource when ensureCanEdit returns false', async () => {
      permissionServiceSpy.ensureCanEdit.and.returnValue(false);
      const fakeResource: ResourceRow = { id: 'r1', label: 'Dev', type: 'role' } as ResourceRow;
      const fakeEquipe: Equipe = { id: 'eq-1', nom: 'Team Alpha' };

      await component.removeResource(fakeResource, fakeEquipe);
      expect(component.showConfirmModal).toBeFalse();
    });

    it('should render selection toolbar in viewer mode when cells are selected', () => {
      (permissionServiceSpy.canEdit as any).set(false);
      (permissionServiceSpy.isViewer as any).set(true);
      component.selectionCtrl.selectedCells = [
        {
          resource: { id: 'r1', label: 'Dev', type: 'role' } as ResourceRow,
          week: new Date(),
          equipeId: 'eq-1',
        } as SelectedCapacityCell,
      ];
      component.selectionCtrl.isSelectionFinished = true;
      fixture.detectChanges();

      const toolbar = fixture.nativeElement.querySelector('app-selection-toolbar');
      expect(toolbar).toBeTruthy();
    });
  });
});
