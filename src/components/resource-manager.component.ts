import { Component, OnInit, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ResourceService } from "../services/resource.service";
import { Societe, Departement, Service, Equipe, Role, Personne } from "../models/types";

@Component({
  selector: "app-resource-manager",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="resource-manager">
      <div class="tabs">
        @for (tab of tabs; track tab.id) {
        <button [class.active]="activeTab === tab.id" (click)="activeTab = tab.id" class="tab-btn">
          {{ tab.label }}
        </button>
        }
      </div>

      <div class="tab-content">
        <div *ngIf="activeTab === 'societe'" class="resource-section">
          <div class="section-header">
            <h3>Sociétés</h3>
            <button class="btn btn-sm btn-primary" (click)="showAddSociete = true">+ Ajouter</button>
          </div>
          <div class="resource-list">
            @for (societe of societes; track societe.id) {
            <div class="resource-item">
              {{ societe.nom }}
            </div>
            }
          </div>

          <div *ngIf="showAddSociete" class="inline-form">
            <input [(ngModel)]="newSociete.nom" placeholder="Nom de la société" />
            <button class="btn btn-sm btn-success" (click)="addSociete()">Créer</button>
            <button class="btn btn-sm btn-secondary" (click)="showAddSociete = false">Annuler</button>
          </div>
        </div>

        <div *ngIf="activeTab === 'departement'" class="resource-section">
          <div class="section-header">
            <h3>Départements</h3>
            <button class="btn btn-sm btn-primary" (click)="showAddDepartement = true">+ Ajouter</button>
          </div>
          <div class="resource-list">
            @for (dept of departements; track dept.id) {
            <div class="resource-item">
              {{ dept.nom }}
            </div>
            }
          </div>

          <div *ngIf="showAddDepartement" class="inline-form">
            <select [(ngModel)]="newDepartement.societe_id" required>
              <option value="">Sélectionner une société</option>
              @for (s of societes; track s.id) {
              <option [value]="s.id">{{ s.nom }}</option>
              }
            </select>
            <input [(ngModel)]="newDepartement.nom" placeholder="Nom du département" />
            <button class="btn btn-sm btn-success" (click)="addDepartement()">Créer</button>
            <button class="btn btn-sm btn-secondary" (click)="showAddDepartement = false">Annuler</button>
          </div>
        </div>

        <div *ngIf="activeTab === 'service'" class="resource-section">
          <div class="section-header">
            <h3>Services</h3>
            <button class="btn btn-sm btn-primary" (click)="showAddService = true">+ Ajouter</button>
          </div>
          <div class="resource-list">
            @for (service of services; track service.id) {
            <div class="resource-item">
              {{ service.nom }}
            </div>
            }
          </div>

          <div *ngIf="showAddService" class="inline-form">
            <select [(ngModel)]="newService.departement_id" required>
              <option value="">Sélectionner un département</option>
              @for (d of departements; track d.id) {
              <option [value]="d.id">{{ d.nom }}</option>
              }
            </select>
            <input [(ngModel)]="newService.nom" placeholder="Nom du service" />
            <button class="btn btn-sm btn-success" (click)="addService()">Créer</button>
            <button class="btn btn-sm btn-secondary" (click)="showAddService = false">Annuler</button>
          </div>
        </div>

        <div *ngIf="activeTab === 'equipe'" class="resource-section">
          <div class="section-header">
            <h3>Équipes</h3>
            <button class="btn btn-sm btn-primary" (click)="showAddEquipe = true">+ Ajouter</button>
          </div>
          <div class="resource-list">
            @for (equipe of equipes; track equipe.id) {
            <div class="resource-item">
              {{ equipe.nom }}
            </div>
            }
          </div>

          <div *ngIf="showAddEquipe" class="inline-form">
            <select [(ngModel)]="newEquipe.service_id" required>
              <option value="">Sélectionner un service</option>
              @for (s of services; track s.id) {
              <option [value]="s.id">{{ s.nom }}</option>
              }
            </select>
            <input [(ngModel)]="newEquipe.nom" placeholder="Nom de l'équipe" />
            <button class="btn btn-sm btn-success" (click)="addEquipe()">Créer</button>
            <button class="btn btn-sm btn-secondary" (click)="showAddEquipe = false">Annuler</button>
          </div>
        </div>

        <div *ngIf="activeTab === 'role'" class="resource-section">
          <div class="section-header">
            <h3>Rôles</h3>
            <button class="btn btn-sm btn-primary" (click)="showAddRole = true">+ Ajouter</button>
          </div>
          <div class="resource-list">
            @for (role of roles; track role.id) {
            <div class="resource-item">
              <span>{{ role.nom }}</span>
              <span class="text-sm text-gray">{{ role.jours_par_semaine }}j/sem</span>
            </div>
            }
          </div>

          <div *ngIf="showAddRole" class="inline-form">
            <input [(ngModel)]="newRole.nom" placeholder="Nom du rôle (ex: Développeur)" />
            <input
              type="number"
              [(ngModel)]="newRole.jours_par_semaine"
              placeholder="Jours/semaine"
              step="0.5"
              min="0.5"
              max="7"
            />
            <button class="btn btn-sm btn-success" (click)="addRole()">Créer</button>
            <button class="btn btn-sm btn-secondary" (click)="showAddRole = false">Annuler</button>
          </div>
        </div>

        <div *ngIf="activeTab === 'personne'" class="resource-section">
          <div class="section-header">
            <h3>Personnes</h3>
            <button class="btn btn-sm btn-primary" (click)="showAddPersonne = true">+ Ajouter</button>
          </div>
          <div class="resource-list">
            @for (personne of personnes; track personne.id) {
            <div class="resource-item">
              <span>{{ personne.prenom }} {{ personne.nom }}</span>
              <span class="text-sm text-gray">{{ personne.jours_par_semaine }}j/sem</span>
            </div>
            }
          </div>

          <div *ngIf="showAddPersonne" class="inline-form">
            <input [(ngModel)]="newPersonne.prenom" placeholder="Prénom" />
            <input [(ngModel)]="newPersonne.nom" placeholder="Nom" />
            <input [(ngModel)]="newPersonne.email" placeholder="Email" type="email" />
            <input
              type="number"
              [(ngModel)]="newPersonne.jours_par_semaine"
              placeholder="Jours/semaine"
              step="0.5"
              min="0.5"
              max="7"
            />
            <button class="btn btn-sm btn-success" (click)="addPersonne()">Créer</button>
            <button class="btn btn-sm btn-secondary" (click)="showAddPersonne = false">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .resource-manager {
        background: white;
        border-radius: 8px;
        overflow: hidden;
      }

      .tabs {
        display: flex;
        border-bottom: 2px solid #e5e7eb;
        background: #f9fafb;
      }

      .tab-btn {
        padding: 12px 24px;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        font-weight: 500;
        color: #6b7280;
        transition: all 0.2s ease;
      }

      .tab-btn:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .tab-btn.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
        background: white;
      }

      .tab-content {
        padding: 24px;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .resource-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }

      .resource-item {
        padding: 12px 16px;
        background: #f9fafb;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.2s ease;
      }

      .resource-item:hover {
        background: #f3f4f6;
      }

      .inline-form {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 16px;
        background: #f0f9ff;
        border-radius: 6px;
        margin-top: 12px;
      }

      .inline-form input,
      .inline-form select {
        flex: 1;
      }
    `,
  ],
})
export class ResourceManagerComponent implements OnInit {
  @Output() resourceCreated = new EventEmitter<void>();

  activeTab = "societe";

  tabs = [
    { id: "societe", label: "Sociétés" },
    { id: "departement", label: "Départements" },
    { id: "service", label: "Services" },
    { id: "equipe", label: "Équipes" },
    { id: "role", label: "Rôles" },
    { id: "personne", label: "Personnes" },
  ];

  societes: Societe[] = [];
  departements: Departement[] = [];
  services: Service[] = [];
  equipes: Equipe[] = [];
  roles: Role[] = [];
  personnes: Personne[] = [];

  showAddSociete = false;
  showAddDepartement = false;
  showAddService = false;
  showAddEquipe = false;
  showAddRole = false;
  showAddPersonne = false;

  newSociete: Partial<Societe> = { nom: "" };
  newDepartement: Partial<Departement> = { nom: "", societe_id: "" };
  newService: Partial<Service> = { nom: "", departement_id: "" };
  newEquipe: Partial<Equipe> = { nom: "", service_id: "" };
  newRole: Partial<Role> = { nom: "", jours_par_semaine: 5 };
  newPersonne: Partial<Personne> = {
    nom: "",
    prenom: "",
    jours_par_semaine: 5,
  };

  constructor(private resourceService: ResourceService) {}

  async ngOnInit() {
    await this.loadAll();
  }

  async loadAll() {
    try {
      this.societes = await this.resourceService.getAllSocietes();
      this.departements = await this.resourceService.getAllDepartements();
      this.services = await this.resourceService.getAllServices();
      this.equipes = await this.resourceService.getAllEquipes();
      this.roles = await this.resourceService.getAllRoles();
      this.personnes = await this.resourceService.getAllPersonnes();
    } catch (error) {
      console.error("Error loading resources:", error);
    }
  }

  async addSociete() {
    try {
      await this.resourceService.createSociete(this.newSociete);
      this.newSociete = { nom: "" };
      this.showAddSociete = false;
      await this.loadAll();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error creating societe:", error);
    }
  }

  async addDepartement() {
    try {
      await this.resourceService.createDepartement(this.newDepartement);
      this.newDepartement = { nom: "", societe_id: "" };
      this.showAddDepartement = false;
      await this.loadAll();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error creating departement:", error);
    }
  }

  async addService() {
    try {
      await this.resourceService.createService(this.newService);
      this.newService = { nom: "", departement_id: "" };
      this.showAddService = false;
      await this.loadAll();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error creating service:", error);
    }
  }

  async addEquipe() {
    try {
      await this.resourceService.createEquipe(this.newEquipe);
      this.newEquipe = { nom: "", service_id: "" };
      this.showAddEquipe = false;
      await this.loadAll();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error creating equipe:", error);
    }
  }

  async addRole() {
    try {
      await this.resourceService.createRole(this.newRole);
      this.newRole = { nom: "", jours_par_semaine: 5 };
      this.showAddRole = false;
      await this.loadAll();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error creating role:", error);
    }
  }

  async addPersonne() {
    try {
      await this.resourceService.createPersonne(this.newPersonne);
      this.newPersonne = { nom: "", prenom: "", jours_par_semaine: 5 };
      this.showAddPersonne = false;
      await this.loadAll();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error creating personne:", error);
    }
  }
}
