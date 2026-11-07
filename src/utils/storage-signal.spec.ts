import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { storageSignal, parseScreenKeyMapping } from './storage-signal';
import { PreferencesService } from '../services/preferences.service';
import { signal } from '@angular/core';

describe('storageSignal adapter', () => {
  it('should parse known screen keys correctly', () => {
    expect(parseScreenKeyMapping('plan-view-zoom-level')).toEqual({ screen: 'plan', prop: 'zoomLevel' });
    expect(parseScreenKeyMapping('plan-view-mode')).toEqual({ screen: 'plan', prop: 'viewMode' });
    expect(parseScreenKeyMapping('capacity-view-zoom-level')).toEqual({ screen: 'capacity', prop: 'zoomLevel' });
    expect(parseScreenKeyMapping('capacity-view-selected-teams')).toEqual({ screen: 'capacity', prop: 'selectedTeamIds' });
    expect(parseScreenKeyMapping('projects_view_mode')).toEqual({ screen: 'projects', prop: 'viewMode' });
    expect(parseScreenKeyMapping('projects_view_status_filter')).toEqual({ screen: 'projects', prop: 'statusFilter' });
    expect(parseScreenKeyMapping('projects_view_search_query')).toEqual({ screen: 'projects', prop: 'searchQuery' });
    expect(parseScreenKeyMapping('plan-view-filter-period-enabled')).toEqual({ screen: 'plan', prop: 'filterPeriodEnabled' });
    expect(parseScreenKeyMapping('plan-view-filter-size-enabled')).toEqual({ screen: 'plan', prop: 'filterSizeEnabled' });
    expect(parseScreenKeyMapping('plan-view-week-filters')).toEqual({ screen: 'plan', prop: 'weekFilters' });
    expect(parseScreenKeyMapping('unknown-key')).toBeNull();
  });

  describe('with mocked PreferencesService in injection context', () => {
    let mockPreferencesService: any;
    let mockPrefsSignal: any;
    let mockIsLoadedSignal: any;

    beforeEach(() => {
      localStorage.clear();
      mockIsLoadedSignal = signal<boolean>(true);
      mockPrefsSignal = signal<any>({
        screens: {
          plan: {
            zoomLevel: 'compact',
          },
        },
      });

      mockPreferencesService = {
        preferences: mockPrefsSignal,
        isLoaded: mockIsLoadedSignal,
        getScreenPreference: vi.fn((screen: string, prop: string, defaultValue: any) => {
          return mockPrefsSignal()?.screens?.[screen]?.[prop] ?? defaultValue;
        }),
        setScreenPreference: vi.fn(),
      };

      TestBed.configureTestingModule({
        providers: [
          { provide: PreferencesService, useValue: mockPreferencesService },
        ],
      });
    });

    it('should read from PreferencesService on creation if available', () => {
      TestBed.runInInjectionContext(() => {
        const s = storageSignal('plan-view-zoom-level', 'normal');
        expect(s()).toBe('compact');
      });
    });

    it('should notify PreferencesService when signal changes', () => {
      TestBed.runInInjectionContext(() => {
        const s = storageSignal('plan-view-zoom-level', 'compact');
        TestBed.flushEffects();

        s.set('normal');
        TestBed.flushEffects();

        expect(mockPreferencesService.setScreenPreference).toHaveBeenCalledWith('plan', 'zoomLevel', 'normal');
        expect(localStorage.getItem('plan-view-zoom-level')).toBe(JSON.stringify('normal'));
      });
    });

    it('should NOT overwrite PreferencesService when isLoaded toggles to true', () => {
      mockIsLoadedSignal.set(false);
      mockPrefsSignal.set({
        screens: {
          plan: {
            filterEquipeIds: ['team-saved-1'],
          },
        },
      });

      TestBed.runInInjectionContext(() => {
        const s = storageSignal<string[]>('plan-view-filter-equipes', []);
        TestBed.flushEffects();

        // Remote preferences finish loading
        mockIsLoadedSignal.set(true);
        TestBed.flushEffects();

        // Should not call setScreenPreference with empty array []
        expect(mockPreferencesService.setScreenPreference).not.toHaveBeenCalled();
        expect(s()).toEqual(['team-saved-1']);
      });
    });
  });
});
