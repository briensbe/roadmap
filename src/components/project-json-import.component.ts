import { Component, EventEmitter, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { LucideAngularModule, FileJson } from "lucide-angular";

@Component({
  selector: "app-project-json-import",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <button
      type="button"
      class="json-import-btn"
      (click)="showPopup = true"
      title="Importer depuis JSON"
    >
      <lucide-icon [img]="FileJson" [size]="18"></lucide-icon>
      <span class="btn-text">JSON</span>
    </button>

    <div *ngIf="showPopup" class="json-popup-overlay" (click)="showPopup = false">
      <div class="json-popup" (click)="$event.stopPropagation()">
        <div class="json-popup-header">
          <h3>Importer un projet (JSON)</h3>
          <button class="close-btn" (click)="showPopup = false">×</button>
        </div>
        <div class="json-popup-body">
          <p class="hint">Collez le JSON ici (format Jira)</p>
          <textarea
            [(ngModel)]="jsonInput"
            placeholder='{ "id": "...", "titre": "...", ... }'
            rows="10"
          ></textarea>
          <div *ngIf="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </div>
        <div class="json-popup-footer">
          <button type="button" class="btn btn-secondary" (click)="showPopup = false">
            Annuler
          </button>
          <button type="button" class="btn btn-primary" (click)="import()">
            Importer
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .json-import-btn {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 9999px;
      padding: 5px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: #111827;
      transition: all 0.2s;
    }
    .json-import-btn:hover {
      background: #e5e7eb;
      color: #000000;
      border-color: #9ca3af;
    }
    .btn-text {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.5px;
    }
    .json-popup-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 4000;
      backdrop-filter: blur(2px);
    }
    .json-popup {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .json-popup-header {
      padding: 16px 20px;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .json-popup-header h3 { margin: 0; font-size: 18px; color: #111827; }
    .close-btn {
      background: none; border: none; font-size: 20px; color: #9ca3af; cursor: pointer;
    }
    .json-popup-body { padding: 20px; }
    .hint { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      resize: vertical;
      background: #f9fafb;
    }
    textarea:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    .error-message {
      color: #ef4444;
      font-size: 12px;
      margin-top: 8px;
      padding: 8px;
      background: #fef2f2;
      border-radius: 6px;
    }
    .json-popup-footer {
      padding: 16px 20px;
      background: #f9fafb;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary { background: #4f46e5; color: white; border: none; }
    .btn-primary:hover { background: #4338ca; }
    .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
    .btn-secondary:hover { background: #f3f4f6; }
  `]
})
export class ProjectJsonImportComponent {
  @Output() imported = new EventEmitter<any>();

  showPopup = false;
  jsonInput = "";
  errorMessage = "";

  FileJson = FileJson;

  import() {
    this.errorMessage = "";
    if (!this.jsonInput.trim()) {
      this.errorMessage = "Veuillez coller du JSON.";
      return;
    }

    try {
      const data = JSON.parse(this.jsonInput);
      
      // Mapping logic
      const mappedData = {
        reference_externe: data.id || "",
        nom_projet: data.titre || "",
        chef_projet: data.reporter || "",
        description: data.description || "",
        code_projet: data["Previa/Triskell"] || ""
      };

      this.imported.emit(mappedData);
      this.showPopup = false;
      this.jsonInput = "";
    } catch (e) {
      this.errorMessage = "JSON invalide. Veuillez vérifier le format.";
      console.error("JSON parse error:", e);
    }
  }
}
