import { Injectable, inject, OnDestroy } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Setting } from "../models/settings.type";
import { QueryClient, injectQuery, injectMutation } from "@tanstack/angular-query-experimental";
import { settingsQueryKeys } from "./settings.query-keys";
import { RealtimeChannel } from "@supabase/supabase-js";

@Injectable({
    providedIn: "root",
})
export class SettingsService implements OnDestroy {
    private supabase = inject(SupabaseService);
    private queryClient = inject(QueryClient);
    private realtimeChannel: RealtimeChannel | null = null;

    constructor() {
        this.setupRealtimeSubscription();
    }

    // ============================================
    // REALTIME SUBSCRIPTION
    // ============================================

    private setupRealtimeSubscription(): void {
        this.realtimeChannel = this.supabase.client
            .channel('settings-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'settings'
                },
                (payload) => {
                    console.log('Settings realtime event received:', payload);

                    switch (payload.eventType) {
                        case 'INSERT':
                            this.handleInsert(payload.new as Setting);
                            break;
                        case 'UPDATE':
                            this.handleUpdate(payload.new as Setting);
                            break;
                        case 'DELETE':
                            this.handleDelete(payload.old as Setting);
                            break;
                    }
                }
            )
            .subscribe((status) => {
                console.log('Realtime subscription status for settings:', status);
            });
    }

    private handleInsert(newSetting: Setting): void {
        this.queryClient.setQueryData(settingsQueryKeys.list(), (old: Setting[] | undefined) => {
            if (!old) return [newSetting];
            if (old.some(s => s.id === newSetting.id)) return old;
            const updated = [...old, newSetting];
            return updated.sort((a, b) => a.key.localeCompare(b.key));
        });
        this.queryClient.setQueryData(settingsQueryKeys.detail(newSetting.id!), newSetting);
        this.queryClient.setQueryData(settingsQueryKeys.byKey(newSetting.key, newSetting.scope), newSetting);
    }

    private handleUpdate(updatedSetting: Setting): void {
        this.queryClient.setQueryData(settingsQueryKeys.list(), (old: Setting[] | undefined) => {
            if (!old) return old;
            const updated = old.map(s => s.id === updatedSetting.id ? updatedSetting : s);
            return updated.sort((a, b) => a.key.localeCompare(b.key));
        });
        this.queryClient.setQueryData(settingsQueryKeys.detail(updatedSetting.id!), updatedSetting);
        this.queryClient.setQueryData(settingsQueryKeys.byKey(updatedSetting.key, updatedSetting.scope), updatedSetting);
        // Also invalidate byKey queries if they exist as a safety measure
        this.queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
    }

    private handleDelete(deletedSetting: Setting): void {
        this.queryClient.setQueryData(settingsQueryKeys.list(), (old: Setting[] | undefined) => {
            if (!old) return old;
            return old.filter(s => s.id !== deletedSetting.id);
        });
        this.queryClient.removeQueries({ queryKey: settingsQueryKeys.detail(deletedSetting.id!) });
        this.queryClient.removeQueries({ queryKey: settingsQueryKeys.byKey(deletedSetting.key, deletedSetting.scope) });
        this.queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
    }

    ngOnDestroy(): void {
        if (this.realtimeChannel) {
            this.supabase.client.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
    }

    // ============================================
    // REACTIVE QUERIES
    // ============================================

    getAllSettingsQuery() {
        return injectQuery(() => ({
            queryKey: settingsQueryKeys.list(),
            queryFn: async () => {
                const { data, error } = await this.supabase.client
                    .from("settings")
                    .select("*")
                    .order("key");

                if (error) throw error;
                return data || [];
            },
            staleTime: Infinity,
        }));
    }

    getSettingQuery(key: string, scope: string = 'global') {
        return injectQuery(() => ({
            queryKey: settingsQueryKeys.byKey(key, scope),
            queryFn: async () => this.getSettingByKey(key, scope),
            staleTime: Infinity,
        }));
    }

    // ============================================
    // QUERIES
    // ============================================

    async getAllSettings(): Promise<Setting[]> {
        const { data, error } = await this.supabase.client
            .from("settings")
            .select("*")
            .order("key");

        if (error) throw error;
        this.queryClient.setQueryData(settingsQueryKeys.list(), data || []);
        return data || [];
    }

    async getSettingByKey(key: string, scope: string = 'global'): Promise<Setting | null> {
        const { data, error } = await this.supabase.client
            .from("settings")
            .select("*")
            .eq("key", key)
            .eq("scope", scope)
            .maybeSingle();

        if (error) throw error;
        // Do NOT set query data here manually, queryFn handles it or we do it in handlers
        return data;
    }


    // ============================================
    // MUTATIONS
    // ============================================

    createSettingMutation() {
        return injectMutation(() => ({
            mutationFn: async (setting: Setting) => {
                const { data, error } = await this.supabase.client
                    .from("settings")
                    .insert([
                        {
                            key: setting.key,
                            value: setting.value,
                            type: setting.type,
                            scope: setting.scope || 'global',
                            description: setting.description,
                        },
                    ])
                    .select()
                    .single();

                if (error) throw error;
                return data;
            },
            onSuccess: (data) => {
                this.queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
            }
        }));
    }

    updateSettingMutation() {
        return injectMutation(() => ({
            mutationFn: async ({ id, setting }: { id: string; setting: Partial<Setting> }) => {
                const updateData: any = { ...setting };
                delete updateData.id;
                delete updateData.created_at;
                updateData.updated_at = new Date().toISOString();

                const { data, error } = await this.supabase.client
                    .from("settings")
                    .update(updateData)
                    .eq("id", id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            },
            onSuccess: (data) => {
                this.queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
            }
        }));
    }

    deleteSettingMutation() {
        return injectMutation(() => ({
            mutationFn: async (id: string) => {
                const { error } = await this.supabase.client
                    .from("settings")
                    .delete()
                    .eq("id", id);

                if (error) throw error;
                return id;
            },
            onSuccess: () => {
                this.queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
            }
        }));
    }

}
