import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Setting } from "../models/settings.type";

@Injectable({
    providedIn: "root",
})
export class SettingsService {
    private _settingsCache: Setting[] | null = null;

    constructor(private supabase: SupabaseService) { }

    private clearCache() {
        this._settingsCache = null;
    }

    async getAllSettings(): Promise<Setting[]> {
        if (this._settingsCache) {
            return this._settingsCache;
        }

        const { data, error } = await this.supabase.client
            .from("settings")
            .select("*")
            .order("key");

        if (error) throw error;
        this._settingsCache = data || [];
        return this._settingsCache;
    }

    async getSettingByKey(key: string, scope: string = 'global'): Promise<Setting | null> {
        const { data, error } = await this.supabase.client
            .from("settings")
            .select("*")
            .eq("key", key)
            .eq("scope", scope)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async getSettingValue(key: string, scope: string = 'global'): Promise<string | null> {
        const setting = await this.getSettingByKey(key, scope);
        return setting ? setting.value : null;
    }

    async createSetting(setting: Setting): Promise<Setting> {
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
        this.clearCache();
        return data;
    }

    async updateSetting(id: string, setting: Partial<Setting>): Promise<Setting> {
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
        this.clearCache();
        return data;
    }

    async deleteSetting(id: string): Promise<void> {
        const { error } = await this.supabase.client
            .from("settings")
            .delete()
            .eq("id", id);

        if (error) throw error;
        this.clearCache();
    }
}
