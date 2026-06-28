import * as Excel from "exceljs";

export interface RawExcelRow {
  budgetType: string | null;
  budgetNomenclature: string | null;
  budgetObject: string | null;
  activityType: string | null;
  projectCode: string;
  projectName: string;
  projectManager: string | null;
  projectStatus: string | null;
  jiraReferences: string[];
  serviceMetrics: {
    [serviceName: string]: {
      initialJh: number | null;
      revisedJh: number | null;
      previsionnelJh: number | null;
      consommeJh: number | null;
    };
  };
}

export interface ExcelImportData {
  excelExportDate: Date;
  rows: RawExcelRow[];
}

export class ExcelReader {
  /**
   * Helper to safely get clean string value from cell
   */
  private getCleanStringValue(cell: Excel.Cell): string | null {
    if (cell.value === null || cell.value === undefined) return null;

    let val: string;
    if (typeof cell.value === "object" && "richText" in cell.value) {
      val = cell.value.richText.map((t) => t.text).join("");
    } else if (typeof cell.value === "object" && "result" in cell.value) {
      val = String(cell.value.result);
    } else {
      val = String(cell.value);
    }

    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  }

  /**
   * Helper to parse numeric value from cell, supporting French decimal comma format
   */
  private parseNumericValue(cell: Excel.Cell): number | null {
    const val = cell.value;
    if (val === null || val === undefined) return null;

    if (typeof val === "number") {
      return isNaN(val) ? null : val;
    }
    if (typeof val === "object" && "result" in val) {
      const res = val.result;
      if (typeof res === "number") return isNaN(res) ? null : res;
      if (res === null || res === undefined) return null;
      const strRes = String(res).trim().replace(/\s+/g, "").replace(",", ".");
      const num = parseFloat(strRes);
      return isNaN(num) ? null : num;
    }

    const str = String(val).trim().replace(/\s+/g, "").replace(",", ".");
    if (str === "") return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Parses the export date from Cell A1
   * E.g. "Export du 05/06/2026 14:26:05"
   */
  private parseExportDate(cellValue: string | null): Date {
    if (!cellValue) {
      return new Date();
    }

    // Pattern to match DD/MM/YYYY and optional HH:mm:ss
    const match = cellValue.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (!match) {
      return new Date();
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed in JS Date
    const year = parseInt(match[3], 10);

    if (match[4]) {
      const hour = parseInt(match[4], 10);
      const min = parseInt(match[5], 10);
      const sec = parseInt(match[6], 10);
      return new Date(year, month, day, hour, min, sec);
    }

    return new Date(year, month, day);
  }

  public async readFile(filePath: string): Promise<ExcelImportData> {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(filePath);
    return this.parseWorkbook(workbook);
  }

  public async readArrayBuffer(buffer: ArrayBuffer): Promise<ExcelImportData> {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(buffer);
    return this.parseWorkbook(workbook);
  }

  private parseWorkbook(workbook: Excel.Workbook): ExcelImportData {
    // Use first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("No worksheet found in the Excel file.");
    }

    // 1. Parse export date from cell A1
    const cellA1 = worksheet.getCell("A1");
    const a1Text = this.getCleanStringValue(cellA1);
    const excelExportDate = this.parseExportDate(a1Text);

    // 2. Scan Row 6 for Column Headers and Row 5 for Services
    const rowServices = worksheet.getRow(5);
    const rowHeaders = worksheet.getRow(6);

    let budgetTypeIdx = -1; // ex : Budget informatique
    let budgetNomenclatureIdx = -1; // Nomenclature budgetaire - Ex. 01-MCO Applicatif logiciel/matériel
    let budgetObjectIdx = -1; // Objet - Ex. 1-Activité récurrente
    let activityTypeIdx = -1; // Type activité - Ex. 00 - Structure - RH - Management
    let codeActiviteIdx = -1; // Code activité - Ex. 2018_008
    let codeEvolutionIdx = -1; // Code évolution
    let activiteIdx = -1; // Activité - Ex. Ev202008-0022
    let chefProjetIdx = -1;
    let statutIdx = -1;
    let jiraIdx = -1;

    interface ServiceColGroup {
      name: string;
      startCol: number;
      metrics: {
        initialIdx: number | null;
        revisedIdx: number | null;
        previsionnelIdx: number | null;
        consommeIdx: number | null;
        restantIdx: number | null;
      };
    }

    const services: ServiceColGroup[] = [];
    let currentService: ServiceColGroup | null = null;

    const colCount = worksheet.columnCount;

    // Scan headers in row 6
    for (let c = 1; c <= colCount; c++) {
      const headerVal = this.getCleanStringValue(rowHeaders.getCell(c));
      const parentVal = this.getCleanStringValue(rowServices.getCell(c));

      if (!headerVal) continue;

      const cleanHeader = headerVal.toLowerCase();

      // Match fixed columns
      if (cleanHeader === "type budget") budgetTypeIdx = c;
      else if (cleanHeader === "nomenclature budgétaire" || cleanHeader === "nomenclature budgetaire")
        budgetNomenclatureIdx = c;
      else if (cleanHeader === "objet") budgetObjectIdx = c;
      else if (cleanHeader === "type activité" || cleanHeader === "type activite") activityTypeIdx = c;
      else if (cleanHeader === "code activité" || cleanHeader === "code activite") codeActiviteIdx = c;
      else if (cleanHeader === "code évolution" || cleanHeader === "code evolution") codeEvolutionIdx = c;
      else if (cleanHeader === "activité" || cleanHeader === "activite") activiteIdx = c;
      else if (cleanHeader === "chef de projet") chefProjetIdx = c;
      else if (cleanHeader === "statut") statutIdx = c;
      else if (
        cleanHeader === "références jira" ||
        cleanHeader === "references jira" ||
        cleanHeader === "ref jira" ||
        cleanHeader.includes("jira")
      )
        jiraIdx = c;
      else {
        // This column belongs to a service block
        // Service names are defined in row 5
        if (parentVal) {
          // If we have a parent name in row 5, check if we should reuse or create new
          const lowerParent = parentVal.toLowerCase();
          // Skip total and variations columns
          if (lowerParent.includes("total") || lowerParent.includes("variation")) {
            currentService = null;
            continue;
          }

          if (currentService && currentService.name === parentVal && c - currentService.startCol < 5) {
            // Reuse current service group
          } else {
            currentService = {
              name: parentVal,
              startCol: c,
              metrics: {
                initialIdx: null,
                revisedIdx: null,
                previsionnelIdx: null,
                consommeIdx: null,
                restantIdx: null,
              },
            };
            services.push(currentService);
          }
        } else if (currentService && c - currentService.startCol < 5) {
          // Empty parentVal on row 5, reuse if within 5 columns
        } else {
          currentService = null;
        }

        // Map the sub-column metric
        if (currentService) {
          if (cleanHeader.includes("initial")) currentService.metrics.initialIdx = c;
          else if (cleanHeader.includes("révisé") || cleanHeader.includes("revise"))
            currentService.metrics.revisedIdx = c;
          else if (cleanHeader.includes("prévisionnel") || cleanHeader.includes("previsionnel"))
            currentService.metrics.previsionnelIdx = c;
          else if (cleanHeader.includes("consommé") || cleanHeader.includes("consomme"))
            currentService.metrics.consommeIdx = c;
          else if (cleanHeader.includes("restant")) currentService.metrics.restantIdx = c;
        }
      }
    }

    // Ensure we have resolved critical headers
    if (activiteIdx === -1) {
      throw new Error("Could not dynamically resolve the 'Activité' column header on Row 6.");
    }

    const rows: RawExcelRow[] = [];

    // Forward Fill state
    let lastBudgetType: string | null = null;
    let lastBudgetNomenclature: string | null = null;
    let lastBudgetObject: string | null = null;
    let lastActivityType: string | null = null;
    let lastProjectCode: string | null = null;

    // Parse rows from row 7 onwards
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 7) return;

      // 1. Update forward fill values first (must execute on all rows to capture grouping context)
      const currentBudgetType = this.getCleanStringValue(row.getCell(budgetTypeIdx));
      if (currentBudgetType) lastBudgetType = currentBudgetType;

      const currentNomenclature = this.getCleanStringValue(row.getCell(budgetNomenclatureIdx));
      if (currentNomenclature) lastBudgetNomenclature = currentNomenclature;

      const currentObject = this.getCleanStringValue(row.getCell(budgetObjectIdx));
      if (currentObject) lastBudgetObject = currentObject;

      const currentActivityType = this.getCleanStringValue(row.getCell(activityTypeIdx));
      if (currentActivityType) lastActivityType = currentActivityType;

      // 2. Only process rows where 'Activité' (projectName) is set
      const projectName = this.getCleanStringValue(row.getCell(activiteIdx));
      if (!projectName) return;

      // Read current row project codes
      const rawCodeActivite = codeActiviteIdx !== -1 ? this.getCleanStringValue(row.getCell(codeActiviteIdx)) : null;
      const rawCodeEvolution = codeEvolutionIdx !== -1 ? this.getCleanStringValue(row.getCell(codeEvolutionIdx)) : null;

      // Resolve priority: current Activity Code, then current Evolution Code
      const currentExplicitCode = rawCodeActivite || rawCodeEvolution;

      if (currentExplicitCode) {
        lastProjectCode = currentExplicitCode;
      }

      // Final project code is either current explicit code, or forward-fill fallback
      const projectCode = currentExplicitCode || lastProjectCode || "";

      // Parse Jira References
      const jiraRaw = jiraIdx !== -1 ? this.getCleanStringValue(row.getCell(jiraIdx)) : null;
      const jiraReferences = jiraRaw ? jiraRaw.split(/\s+/).filter((ref) => ref.length > 0) : [];

      const projectManager = chefProjetIdx !== -1 ? this.getCleanStringValue(row.getCell(chefProjetIdx)) : null;
      const projectStatus = statutIdx !== -1 ? this.getCleanStringValue(row.getCell(statutIdx)) : null;

      // Read services metrics
      const serviceMetrics: { [serviceName: string]: any } = {};
      for (const service of services) {
        const initial = service.metrics.initialIdx
          ? this.parseNumericValue(row.getCell(service.metrics.initialIdx))
          : null;
        const revised = service.metrics.revisedIdx
          ? this.parseNumericValue(row.getCell(service.metrics.revisedIdx))
          : null;
        const previsionnel = service.metrics.previsionnelIdx
          ? this.parseNumericValue(row.getCell(service.metrics.previsionnelIdx))
          : null;
        const consomme = service.metrics.consommeIdx
          ? this.parseNumericValue(row.getCell(service.metrics.consommeIdx))
          : null;

        serviceMetrics[service.name] = {
          initialJh: initial,
          revisedJh: revised,
          previsionnelJh: previsionnel,
          consommeJh: consomme,
        };
      }

      rows.push({
        budgetType: lastBudgetType,
        budgetNomenclature: lastBudgetNomenclature,
        budgetObject: lastBudgetObject,
        activityType: lastActivityType,
        projectCode,
        projectName,
        projectManager,
        projectStatus,
        jiraReferences,
        serviceMetrics,
      });
    });

    return {
      excelExportDate,
      rows,
    };
  }
}
