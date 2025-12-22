import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Service } from "../models/types";

@Injectable({
    providedIn: "root"
})
export class ServicesService {
    private _servicesCache: Service[] | null = null;

    constructor(private supabase: SupabaseService) { }

    private clearCache() {
        this._servicesCache = null;
    }

    /**
     * Reccupère tous les services avec gestion de cache
     */
    async getAllServices(): Promise<Service[]> {
        if (this._servicesCache) {
            return this._servicesCache;
        }

        const { data, error } = await this.supabase.client
            .from("services")
            .select("*")
            .order("nom", { ascending: true });

        if (error) throw error;
        this._servicesCache = data || [];
        return this._servicesCache;
    }

    /**
     * Trouve l'ID (UUID) à partir de l'id_service (Serial/Number)
     */
    async getIdByServiceId(id_service: number): Promise<string | null> {
        const services = await this.getAllServices();
        const service = services.find(s => s.id_service === id_service);
        return service?.id || null;
    }

    /**
     * Trouve l'id_service (Serial/Number) à partir de l'ID (UUID)
     */
    async getServiceIdById(id: string): Promise<number | null> {
        const services = await this.getAllServices();
        const service = services.find(s => s.id === id);
        return service?.id_service || null;
    }

    /**
     * Récupère un service spécifique par son ID
     */
    async getService(id: string): Promise<Service | null> {
        // Tente de trouver dans le cache d'abord
        if (this._servicesCache) {
            const found = this._servicesCache.find(s => s.id === id);
            if (found) return found;
        }

        const { data, error } = await this.supabase.client
            .from("services")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async createService(service: Partial<Service>): Promise<Service> {
        const { data, error } = await this.supabase.client
            .from("services")
            .insert([service])
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    }

    async updateService(id: string, service: Partial<Service>): Promise<Service> {
        const { data, error } = await this.supabase.client
            .from("services")
            .update(service)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    }

    async deleteService(id: string): Promise<void> {
        const { error } = await this.supabase.client
            .from("services")
            .delete()
            .eq("id", id);

        if (error) throw error;
        this.clearCache();
    }
}
