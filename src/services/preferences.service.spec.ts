import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { PreferencesService, deepEqual } from './preferences.service';
import { SupabaseService } from './supabase.service';
import { DEFAULT_USER_PREFERENCES } from '../models/preferences.model';
import { User } from '@supabase/supabase-js';
import { DB_TABLES } from '../constants/db-tables';

describe('PreferencesService', () => {
  describe('deepEqual', () => {
    it('should compare primitives correctly', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('a', 'a')).toBe(true);
      expect(deepEqual('a', 'b')).toBe(false);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should compare arrays correctly', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should compare nested objects correctly', () => {
      const objA = { a: 1, b: { c: 'hello', d: [1, 2] } };
      const objB = { a: 1, b: { c: 'hello', d: [1, 2] } };
      const objC = { a: 1, b: { c: 'hello', d: [1, 3] } };
      expect(deepEqual(objA, objB)).toBe(true);
      expect(deepEqual(objA, objC)).toBe(false);
    });
  });

  let service: PreferencesService;
  let userSignal: WritableSignal<User | null>;
  let beforeSignOutCallback: (() => Promise<void>) | null = null;
  let mockUpsert: any;
  let mockSelect: any;
  let mockEq: any;
  let mockMaybeSingle: any;
  let mockFrom: any;

  const mockUser: User = {
    id: 'user-uuid-123',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
  };

  beforeEach(() => {
    userSignal = signal<User | null>(null);
    beforeSignOutCallback = null;

    mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    mockFrom = vi.fn((table: string) => {
      if (table === DB_TABLES.USER_PREFERENCES) {
        return {
          select: mockSelect,
          upsert: mockUpsert,
        };
      }
      return {};
    });

    const mockSupabaseService = {
      registerBeforeSignOut: vi.fn((cb: () => Promise<void>) => {
        beforeSignOutCallback = cb;
      }),
      user: userSignal,
      client: {
        from: mockFrom,
      },
    };

    TestBed.configureTestingModule({
      providers: [
        PreferencesService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    });

    service = TestBed.inject(PreferencesService);
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('should initialize with default preferences', () => {
    expect(service.preferences().theme).toBe('system');
    expect(service.preferences().screens?.plan?.zoomLevel).toBe('compact');
    expect(service.preferences().screens?.capacity?.zoomLevel).toBe('compact');
    expect(service.isDirty()).toBe(false);
  });

  it('should load remote preferences when user connects', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        preferences: {
          theme: 'dark',
          screens: {
            plan: {
              zoomLevel: 'normal',
            },
          },
        },
      },
      error: null,
    });

    await service.loadPreferences('user-uuid-123');

    expect(service.preferences().theme).toBe('dark');
    expect(service.preferences().screens?.plan?.zoomLevel).toBe('normal');
    expect(service.isDirty()).toBe(false);
  });

  it('should update theme and schedule a debounced flush', async () => {
    userSignal.set(mockUser);
    service.setTheme('dark');

    expect(service.preferences().theme).toBe('dark');
    expect(service.isDirty()).toBe(true);

    vi.advanceTimersByTime(1600);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-uuid-123',
        preferences: expect.objectContaining({ theme: 'dark' }),
      }),
      { onConflict: 'user_id' }
    );
  });

  it('should update screen preference and schedule a debounced flush', async () => {
    userSignal.set(mockUser);
    service.setScreenPreference('plan', 'viewMode', 'service');

    expect(service.getScreenPreference('plan', 'viewMode', 'resource')).toBe('service');
    expect(service.isDirty()).toBe(true);

    vi.advanceTimersByTime(1600);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('should update lastSeenReleaseNotesVersion', async () => {
    userSignal.set(mockUser);
    service.setLastSeenReleaseNotesVersion('2026.11.07');

    expect(service.preferences().releaseNotes?.lastSeenVersion).toBe('2026.11.07');
    expect(service.isDirty()).toBe(true);

    vi.advanceTimersByTime(1600);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});
