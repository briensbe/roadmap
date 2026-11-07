import { signal, WritableSignal, effect, inject, untracked } from '@angular/core';
import { PreferencesService, deepEqual } from '../services/preferences.service';

export interface StorageSignalScreenMapping {
  screen: 'plan' | 'capacity' | 'projects';
  prop: string;
}

/**
 * Maps a localStorage key to a screen identifier and corresponding property path.
 */
export function parseScreenKeyMapping(key: string): StorageSignalScreenMapping | null {
  // 1. Plan View
  if (key === 'plan-view-mode') return { screen: 'plan', prop: 'viewMode' };
  if (key === 'plan-view-zoom-level') return { screen: 'plan', prop: 'zoomLevel' };
  if (key === 'plan-view-show-availability') return { screen: 'plan', prop: 'showAvailability' };
  if (key === 'plan-view-chiffre-mode') return { screen: 'plan', prop: 'chiffreMode' };
  if (key === 'plan-view-planning-mode') return { screen: 'plan', prop: 'planningMode' };
  if (key === 'plan-view-capacity-year') return { screen: 'plan', prop: 'selectedCapacityYear' };
  if (key === 'plan-view-label-column-width') return { screen: 'plan', prop: 'labelColumnWidth' };
  if (key === 'plan-view-week-filters') return { screen: 'plan', prop: 'weekFilters' };
  if (key === 'plan-view-filter-equipes') return { screen: 'plan', prop: 'filterEquipeIds' };
  if (key === 'plan-view-filter-projets') return { screen: 'plan', prop: 'filterProjetIds' };
  if (key === 'plan-view-filter-resources') return { screen: 'plan', prop: 'filterResourceIds' };
  if (key === 'plan-view-filter-statuses') return { screen: 'plan', prop: 'filterStatusIds' };
  if (key === 'plan-view-filter-jalon-types') return { screen: 'plan', prop: 'filterJalonTypes' };
  if (key === 'plan-view-filter-period-enabled') return { screen: 'plan', prop: 'filterPeriodEnabled' };
  if (key === 'plan-view-filter-period-start') return { screen: 'plan', prop: 'filterPeriodStart' };
  if (key === 'plan-view-filter-period-end') return { screen: 'plan', prop: 'filterPeriodEnd' };
  if (key === 'plan-view-filter-size-enabled') return { screen: 'plan', prop: 'filterSizeEnabled' };
  if (key === 'plan-view-filter-size-criterion') return { screen: 'plan', prop: 'filterSizeCriterion' };
  if (key === 'plan-view-filter-size-operator') return { screen: 'plan', prop: 'filterSizeOperator' };
  if (key === 'plan-view-filter-size-value') return { screen: 'plan', prop: 'filterSizeValue' };
  if (key === 'plan-view-global-search') return { screen: 'plan', prop: 'globalSearch' };
  if (key === 'plan-view-filter-search') return { screen: 'plan', prop: 'filterProjetSearch' };
  if (key === 'tutorial-actions-menu-v1') return { screen: 'plan', prop: 'hasSeenTutorialActions' };
  if (key === 'tutorial-view-mode-selector-v1') return { screen: 'plan', prop: 'hasSeenTutorialViewMode' };

  // 2. Capacity View
  if (key === 'capacity-view-zoom-level') return { screen: 'capacity', prop: 'zoomLevel' };
  if (key === 'capacity-view-selected-teams') return { screen: 'capacity', prop: 'selectedTeamIds' };

  // 3. Projects View
  if (key === 'projects_view_mode') return { screen: 'projects', prop: 'viewMode' };
  if (key === 'projects_view_status_filter') return { screen: 'projects', prop: 'statusFilter' };
  if (key === 'projects_view_search_query') return { screen: 'projects', prop: 'searchQuery' };

  return null;
}

/**
 * Creates a WritableSignal that syncs with localStorage and PreferencesService.
 *
 * @param key The localStorage key to use.
 * @param initialValue The initial value to use if no value is found.
 * @returns A WritableSignal initialized with the stored value or initialValue.
 */
export function storageSignal<T>(key: string, initialValue: T): WritableSignal<T> {
  let preferencesService: PreferencesService | null = null;
  try {
    preferencesService = inject(PreferencesService, { optional: true });
  } catch {
    // Outside Angular injection context
  }

  const mapping = parseScreenKeyMapping(key);

  // 1. Read initial value: PreferencesService takes precedence if loaded, else localStorage, else initialValue
  let value: T = initialValue;

  if (mapping && preferencesService) {
    const remoteVal = preferencesService.getScreenPreference<T>(mapping.screen, mapping.prop, initialValue);
    if (remoteVal !== undefined && remoteVal !== initialValue) {
      value = remoteVal;
    }
  }

  if (value === initialValue && typeof localStorage !== 'undefined') {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      try {
        value = JSON.parse(storedValue);
      } catch (e) {
        console.warn(`Error parsing localStorage key "${key}":`, e);
      }
    }
  }

  const s = signal<T>(value);

  // 2. Sync changes from signal to localStorage and PreferencesService
  effect(() => {
    const v = s();
    if (mapping && preferencesService) {
      // Use untracked to avoid triggering this effect when remote preferences finish loading
      const isLoaded = untracked(() => preferencesService!.isLoaded());
      if (isLoaded) {
        const currentRemoteVal = untracked(() =>
          preferencesService!.getScreenPreference<T | undefined>(mapping.screen, mapping.prop, undefined)
        );
        if (!deepEqual(v, currentRemoteVal)) {
          preferencesService.setScreenPreference(mapping.screen, mapping.prop, v);
        }
      }
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(v));
      }
    } catch (e) {
      console.error(`Error saving to localStorage key "${key}":`, e);
    }
  });

  // 3. Sync from PreferencesService when remote preferences are loaded from Supabase
  if (mapping && preferencesService) {
    effect(() => {
      const screens = preferencesService?.preferences().screens;
      if (!screens) return;
      const screenObj = screens[mapping.screen] as Record<string, unknown> | undefined;
      const remoteVal = screenObj?.[mapping.prop] as T | undefined;
      if (remoteVal !== undefined && !deepEqual(remoteVal, s())) {
        s.set(remoteVal);
      }
    });
  }

  return s;
}
