import { Injectable, inject, OnDestroy } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Projet } from "../models/types";
import { LexoRank } from "lexorank";
import { QueryClient, injectQuery, injectMutation } from "@tanstack/angular-query-experimental";
import { projetQueryKeys } from "./projet.query-keys";
import { RealtimeChannel } from "@supabase/supabase-js";

@Injectable({
  providedIn: "root"
})
export class ProjetService implements OnDestroy {
  private supabase = inject(SupabaseService);
  private queryClient = inject(QueryClient);
  private realtimeChannel: RealtimeChannel | null = null;

  constructor() {
    // Setup realtime subscription on service initialization
    this.setupRealtimeSubscription();
  }

  // ============================================
  // REALTIME SUBSCRIPTION
  // ============================================

  /**
   * Setup Supabase realtime subscription for the projets table
   * Automatically updates TanStack Query cache on INSERT, UPDATE, DELETE events
   */
  private setupRealtimeSubscription(): void {
    this.realtimeChannel = this.supabase.client
      .channel('projets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projets'
        },
        (payload) => {
          console.log('Realtime event received:', payload);

          switch (payload.eventType) {
            case 'INSERT':
              this.handleInsert(payload.new as Projet);
              break;
            case 'UPDATE':
              this.handleUpdate(payload.new as Projet);
              break;
            case 'DELETE':
              this.handleDelete(payload.old as Projet);
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
  }

  /**
   * Handle INSERT events from realtime subscription
   */
  private handleInsert(newProjet: Projet): void {
    // Add to list cache, maintaining sort order by rank
    this.queryClient.setQueryData(projetQueryKeys.list(), (old: Projet[] | undefined) => {
      if (!old) return [newProjet];

      // Check if project already exists (avoid duplicates)
      if (old.some(p => p.id === newProjet.id)) return old;

      // Add and sort by rank
      const updated = [...old, newProjet];
      return updated.sort((a, b) => (a.rank || '').localeCompare(b.rank || ''));
    });

    // Add to detail cache
    this.queryClient.setQueryData(projetQueryKeys.detail(newProjet.id!), newProjet);
  }

  /**
   * Handle UPDATE events from realtime subscription
   */
  private handleUpdate(updatedProjet: Projet): void {
    // Update in list cache
    this.queryClient.setQueryData(projetQueryKeys.list(), (old: Projet[] | undefined) => {
      if (!old) return old;

      const updated = old.map(p => p.id === updatedProjet.id ? updatedProjet : p);
      // Re-sort in case rank changed
      return updated.sort((a, b) => (a.rank || '').localeCompare(b.rank || ''));
    });

    // Update detail cache
    this.queryClient.setQueryData(projetQueryKeys.detail(updatedProjet.id!), updatedProjet);
  }

  /**
   * Handle DELETE events from realtime subscription
   */
  private handleDelete(deletedProjet: Projet): void {
    // Remove from list cache
    this.queryClient.setQueryData(projetQueryKeys.list(), (old: Projet[] | undefined) => {
      if (!old) return old;
      return old.filter(p => p.id !== deletedProjet.id);
    });

    // Remove detail cache
    this.queryClient.removeQueries({ queryKey: projetQueryKeys.detail(deletedProjet.id!) });
  }

  /**
   * Cleanup realtime subscription when service is destroyed
   */
  ngOnDestroy(): void {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  // ============================================
  // REACTIVE QUERIES - For component use
  // ============================================

  /**
   * Reactive query for all projects - returns a Signal
   * Use this in components for automatic UI updates
   */
  getAllProjetsQuery() {
    return injectQuery(() => ({
      queryKey: projetQueryKeys.list(),
      queryFn: async () => {
        const { data, error } = await this.supabase.client
          .from("projets")
          .select("*")
          .order("rank", { ascending: true });

        if (error) throw error;
        return data || [];
      },
      // Ajoutez ces 3 lignes ⬇️
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnReconnect: false,
    }));
  }


  // ============================================
  // QUERIES - Read Operations
  // ============================================

  /**
   * Get all projects with automatic caching
   */
  async getAllProjets(): Promise<Projet[]> {
    // Try to get from cache first
    const cached = this.queryClient.getQueryData<Projet[]>(projetQueryKeys.list());
    if (cached) return cached;

    // Fetch and cache
    const { data, error } = await this.supabase.client
      .from("projets")
      .select("*")
      .order("rank", { ascending: true });

    if (error) throw error;

    // Store in cache
    this.queryClient.setQueryData(projetQueryKeys.list(), data || []);
    return data || [];
  }

  /**
   * Get a single project by ID
   */
  async getProjet(id: string): Promise<Projet | null> {
    // Try to get from cache first
    const cached = this.queryClient.getQueryData<Projet | null>(projetQueryKeys.detail(id));
    if (cached) return cached;

    // Try to find in the list cache
    const listCache = this.queryClient.getQueryData<Projet[]>(projetQueryKeys.list());
    if (listCache) {
      const found = listCache.find((p) => p.id === id) || null;
      if (found) {
        this.queryClient.setQueryData(projetQueryKeys.detail(id), found);
        return found;
      }
    }

    // Fetch from database
    const { data, error } = await this.supabase.client
      .from("projets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    // Store in cache
    this.queryClient.setQueryData(projetQueryKeys.detail(id), data);
    return data;
  }

  /**
   * Get project UUID from id_projet
   */
  async getProjetIdUUID(idProjet: number): Promise<string> {
    // Try to get from cache first
    const cached = this.queryClient.getQueryData<string>(projetQueryKeys.byIdProjet(idProjet));
    if (cached) return cached;

    // Try to find in the list cache
    const listCache = this.queryClient.getQueryData<Projet[]>(projetQueryKeys.list());
    if (listCache) {
      const found = listCache.find((p) => p.id_projet === idProjet);
      if (found && found.id) {
        this.queryClient.setQueryData(projetQueryKeys.byIdProjet(idProjet), found.id);
        return found.id;
      }
    }

    // Fetch from database
    const { data, error } = await this.supabase.client
      .from("projets")
      .select("id")
      .eq("id_projet", idProjet)
      .single();

    if (error) throw error;

    // Store in cache
    this.queryClient.setQueryData(projetQueryKeys.byIdProjet(idProjet), data.id);
    return data.id;
  }

  /**
   * Get all equipe-projet links
   */
  async getAllEquipeProjetLinks(): Promise<{ equipe_id: string; projet_id: string }[]> {
    // Try to get from cache first
    const cached = this.queryClient.getQueryData<{ equipe_id: string; projet_id: string }[]>(
      projetQueryKeys.equipeLinks()
    );
    if (cached) return cached;

    // Fetch from database
    const { data, error } = await this.supabase.client
      .from("equipes_projets")
      .select("*");

    if (error) throw error;

    // Store in cache
    this.queryClient.setQueryData(projetQueryKeys.equipeLinks(), data || []);
    return data || [];
  }

  // ============================================
  // REACTIVE MUTATIONS - For component use
  // ============================================

  /**
   * Mutation for creating a project
   * Automatically invalidates cache on success
   */
  createProjetMutation() {
    return injectMutation(() => ({
      mutationFn: async (projet: Partial<Projet>) => {
        // 1. Fetch only the project with the highest rank to calculate next rank
        const { data: highestRankProject } = await this.supabase.client
          .from("projets")
          .select("rank")
          .not("rank", "is", null)
          .order("rank", { ascending: false })
          .limit(1)
          .maybeSingle();

        let newRank: LexoRank;
        if (highestRankProject && highestRankProject.rank) {
          try {
            newRank = LexoRank.parse(highestRankProject.rank).genNext();
          } catch (e) {
            newRank = LexoRank.middle();
          }
        } else {
          newRank = LexoRank.middle();
        }

        projet.rank = newRank.toString();

        // 2. Insert the project
        const { data, error } = await this.supabase.client
          .from("projets")
          .insert([projet])
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: (data) => {
        // Optimistic update: add to list cache
        this.queryClient.setQueryData(projetQueryKeys.list(), (old: Projet[] | undefined) => {
          if (!old) return [data];
          return [...old, data];
        });
        this.queryClient.setQueryData(projetQueryKeys.detail(data.id!), data);
        this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.equipeLinks() });
      },

    }));
  }

  /**
   * Mutation for updating a project
   * Automatically invalidates cache on success
   */
  updateProjetMutation() {
    return injectMutation(() => ({
      mutationFn: async ({ id, projet }: { id: string; projet: Partial<Projet> }) => {
        const { data, error } = await this.supabase.client
          .from("projets")
          .update({ ...projet, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: (data) => {
        // Optimistic update: update in list cache
        this.queryClient.setQueryData(projetQueryKeys.list(), (old: Projet[] | undefined) => {
          if (!old) return old;
          return old.map(p => p.id === data.id ? data : p);
        });
        this.queryClient.setQueryData(projetQueryKeys.detail(data.id!), data);
      },

    }));
  }

  /**
   * Mutation for deleting a project
   * Automatically invalidates cache on success
   */
  deleteProjetMutation() {
    return injectMutation(() => ({
      mutationFn: async (id: string) => {
        const { error } = await this.supabase.client
          .from("projets")
          .delete()
          .eq("id", id);

        if (error) throw error;
        return id;
      },
      onSuccess: (id) => {
        // Optimistic update: remove from list cache
        this.queryClient.setQueryData(projetQueryKeys.list(), (old: Projet[] | undefined) => {
          if (!old) return old;
          return old.filter(p => p.id !== id);
        });
        this.queryClient.removeQueries({ queryKey: projetQueryKeys.detail(id) });
        this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.equipeLinks() });
      },

    }));
  }

  // ============================================
  // MUTATIONS - Write Operations (Legacy - for backward compatibility)
  // ============================================

  /**
   * Create a new project with automatic rank assignment
   */
  async createProjet(projet: Partial<Projet>): Promise<Projet> {
    // 1. Fetch only the project with the highest rank to calculate next rank
    const { data: highestRankProject } = await this.supabase.client
      .from("projets")
      .select("rank")
      .not("rank", "is", null)
      .order("rank", { ascending: false })
      .limit(1)
      .maybeSingle();

    let newRank: LexoRank;
    if (highestRankProject && highestRankProject.rank) {
      try {
        newRank = LexoRank.parse(highestRankProject.rank).genNext();
      } catch (e) {
        newRank = LexoRank.middle();
      }
    } else {
      newRank = LexoRank.middle();
    }

    projet.rank = newRank.toString();

    // 2. Insert the project
    const { data, error } = await this.supabase.client
      .from("projets")
      .insert([projet])
      .select()
      .single();

    if (error) throw error;

    // 3. Invalidate queries to trigger refetch
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.all });
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.equipeLinks() });

    return data;
  }

  /**
   * Update an existing project
   */
  async updateProjet(id: string, projet: Partial<Projet>): Promise<Projet> {
    const { data, error } = await this.supabase.client
      .from("projets")
      .update({ ...projet, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate queries to trigger refetch
    //await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.all }); // PAS BESOIN !!
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.detail(id) });

    return data;
  }

  /**
   * Delete a project
   */
  async deleteProjet(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("projets")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // Invalidate queries to trigger refetch
    //await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.all }); // PAS BESOIN !!
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.detail(id) });
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.equipeLinks() });
  }

  /**
   * Link a project to a team
   */
  async linkProjectToTeam(projetId: string, equipeId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("equipes_projets")
      .insert({ projet_id: projetId, equipe_id: equipeId });

    if (error) throw error;

    // Invalidate queries to trigger refetch
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.equipeLinks() });
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.detail(projetId) });
  }

  /**
   * Unlink a project from a team
   */
  async unlinkProjectFromTeam(projetId: string, equipeId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("equipes_projets")
      .delete()
      .eq("projet_id", projetId)
      .eq("equipe_id", equipeId);

    if (error) throw error;

    // Invalidate queries to trigger refetch
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.equipeLinks() });
    await this.queryClient.invalidateQueries({ queryKey: projetQueryKeys.detail(projetId) });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Calculate RAF (Reste à Faire) for a project
   */
  calculateRAF(projet: Projet): number {
    return projet.chiffrage_previsionnel - projet.temps_consomme;
  }
}
