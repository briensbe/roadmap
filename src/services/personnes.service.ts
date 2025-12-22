import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Personne } from "../models/types";

@Injectable({
    providedIn: "root"
})
export class PersonnesService {
    private _personnesCache: Personne[] | null = null;

    constructor(private supabase: SupabaseService) { }

    private clearCache() {
        this._personnesCache = null;
    }

    /**
     * Récupère toutes les personnes avec gestion de cache
     */
    async getAllPersonnes(): Promise<Personne[]> {
        if (this._personnesCache) {
            return this._personnesCache;
        }

        const { data, error } = await this.supabase.client
            .from("personnes")
            .select("*")
            .order("nom", { ascending: true });

        if (error) throw error;
        this._personnesCache = data || [];
        return this._personnesCache;
    }

    /**
     * Récupère une personne spécifique par son ID
     */
    async getPersonne(id: string): Promise<Personne | null> {
        // Tente de trouver dans le cache d'abord
        if (this._personnesCache) {
            const found = this._personnesCache.find(p => p.id === id);
            if (found) return found;
        }

        const { data, error } = await this.supabase.client
            .from("personnes")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    /**
     * Récupère le service_id (UUID) et l'id_service (Serial) d'une personne
     */
    async getServiceIdsByPersonneId(personneId: string): Promise<{ service_id: string | null, id_service: number | null }> {
        const personne = await this.getPersonne(personneId);
        if (!personne) {
            return { service_id: null, id_service: null };
        }
        return {
            service_id: personne.service_id || null,
            id_service: personne.id_service || null
        };
    }

    async createPersonne(personne: Partial<Personne>): Promise<Personne> {
        const { data, error } = await this.supabase.client
            .from("personnes")
            .insert([personne])
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    }

    async updatePersonne(id: string, personne: Partial<Personne>): Promise<Personne> {
        const { data, error } = await this.supabase.client
            .from("personnes")
            .update(personne)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    }

    async deletePersonne(id: string): Promise<void> {
        const { error } = await this.supabase.client
            .from("personnes")
            .delete()
            .eq("id", id);

        if (error) throw error;
        this.clearCache();
    }
}
