import { TestBed } from '@angular/core/testing';
import { PermissionService } from './permission.service';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { signal, computed } from '@angular/core';
import { RoadmapRole } from '../auth/types/user.type';

describe('PermissionService', () => {
  let service: PermissionService;
  let userRoleSignal: ReturnType<typeof signal<RoadmapRole | null>>;
  let toastInfoSpy: jasmine.Spy;

  beforeEach(() => {
    userRoleSignal = signal<RoadmapRole | null>('viewer');
    toastInfoSpy = jasmine.createSpy('toast.info');

    const mockSupabaseService = {
      userRole: computed(() => userRoleSignal()),
    };

    const mockToastService = {
      info: toastInfoSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ToastService, useValue: mockToastService },
      ],
    });

    service = TestBed.inject(PermissionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isViewer & canEdit signals', () => {
    it('should evaluate isViewer=true and canEdit=false when role is viewer', () => {
      userRoleSignal.set('viewer');
      expect(service.isViewer()).toBe(true);
      expect(service.canEdit()).toBe(false);
    });

    it('should evaluate isViewer=false and canEdit=true when role is editor', () => {
      userRoleSignal.set('editor');
      expect(service.isViewer()).toBe(false);
      expect(service.canEdit()).toBe(true);
    });

    it('should evaluate isViewer=false and canEdit=true when role is admin', () => {
      userRoleSignal.set('admin');
      expect(service.isViewer()).toBe(false);
      expect(service.canEdit()).toBe(true);
    });

    it('should evaluate isViewer=false and canEdit=false when role is null', () => {
      userRoleSignal.set(null);
      expect(service.isViewer()).toBe(false);
      expect(service.canEdit()).toBe(false);
    });
  });

  describe('ensureCanEdit()', () => {
    it('should block editing and display info toast when role is viewer', () => {
      userRoleSignal.set('viewer');

      const allowed = service.ensureCanEdit();

      expect(allowed).toBe(false);
      expect(toastInfoSpy).toHaveBeenCalledWith(
        'Vous êtes en mode consultation (viewer) : les modifications ne sont pas autorisées.',
      );
    });

    it('should use custom message when provided for viewer', () => {
      userRoleSignal.set('viewer');

      const allowed = service.ensureCanEdit('Message personnalisé');

      expect(allowed).toBe(false);
      expect(toastInfoSpy).toHaveBeenCalledWith('Message personnalisé');
    });

    it('should permit editing without showing toast when role is editor', () => {
      userRoleSignal.set('editor');

      const allowed = service.ensureCanEdit();

      expect(allowed).toBe(true);
      expect(toastInfoSpy).not.toHaveBeenCalled();
    });

    it('should permit editing without showing toast when role is admin', () => {
      userRoleSignal.set('admin');

      const allowed = service.ensureCanEdit();

      expect(allowed).toBe(true);
      expect(toastInfoSpy).not.toHaveBeenCalled();
    });
  });
});
