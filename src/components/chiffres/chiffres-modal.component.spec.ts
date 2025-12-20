import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ChiffresModalComponent } from "./chiffres-modal.component";
import { ChiffresService } from "../services/chiffres.service";
import { ResourceService } from "../services/resource.service";
import { Chiffre } from "../models/chiffres.type";
import { Service } from "../models/types";

describe("ChiffresModalComponent", () => {
  let component: ChiffresModalComponent;
  let fixture: ComponentFixture<ChiffresModalComponent>;
  let chiffresService: jasmine.SpyObj<ChiffresService>;
  let resourceService: jasmine.SpyObj<ResourceService>;

  beforeEach(async () => {
    const chiffresServiceSpy = jasmine.createSpyObj("ChiffresService", [
      "getAllChiffres",
      "getChiffresByProject",
      "getChiffre",
      "createChiffre",
      "updateChiffre",
      "deleteChiffre",
      "getRAFByDate",
    ]);

    const resourceServiceSpy = jasmine.createSpyObj("ResourceService", ["getAllServices"]);

    await TestBed.configureTestingModule({
      imports: [ChiffresModalComponent],
      providers: [
        { provide: ChiffresService, useValue: chiffresServiceSpy },
        { provide: ResourceService, useValue: resourceServiceSpy },
      ],
    }).compileComponents();

    chiffresService = TestBed.inject(ChiffresService) as jasmine.SpyObj<ChiffresService>;
    resourceService = TestBed.inject(ResourceService) as jasmine.SpyObj<ResourceService>;

    fixture = TestBed.createComponent(ChiffresModalComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("loadServices", () => {
    it("should load services on init", async () => {
      const mockServices: Service[] = [
        { id: "1", nom: "Service 1", departement_id: "dept1" },
        { id: "2", nom: "Service 2", departement_id: "dept1" },
      ];

      resourceService.getAllServices.and.returnValue(Promise.resolve(mockServices));

      await component.loadServices();

      expect(resourceService.getAllServices).toHaveBeenCalled();
      expect(component.services).toEqual(mockServices);
    });

    it("should handle service loading error", async () => {
      const error = new Error("Loading failed");
      resourceService.getAllServices.and.returnValue(Promise.reject(error));

      await component.loadServices();

      expect(component.error).toBeTruthy();
    });
  });

  describe("loadChiffres", () => {
    beforeEach(() => {
      component.services = [
        { id: "1", nom: "Service 1", departement_id: "dept1" },
        { id: "2", nom: "Service 2", departement_id: "dept1" },
      ];
      component.idProjet = 1;
    });

    it("should load chiffres for project", async () => {
      const mockChiffres: Chiffre[] = [
        {
          id_chiffres: 1,
          id_projet: 1,
          id_service: 1,
          initial: 100,
          revise: 110,
          previsionnel: 120,
          consomme: 50,
          date_mise_a_jour: "2024-01-15",
        },
      ];

      chiffresService.getChiffresByProject.and.returnValue(Promise.resolve(mockChiffres));

      await component.loadChiffres();

      expect(chiffresService.getChiffresByProject).toHaveBeenCalledWith(1);
      expect(component.chiffres.size).toBeGreaterThan(0);
    });

    it("should initialize empty form data for services without chiffres", async () => {
      chiffresService.getChiffresByProject.and.returnValue(Promise.resolve([]));

      await component.loadChiffres();

      expect(component.chiffres.size).toBe(2); // Two services
      for (const formData of component.chiffres.values()) {
        expect(formData.id_chiffres).toBeUndefined();
      }
    });
  });

  describe("updateCalculatedFields", () => {
    it("should calculate delta correctly", () => {
      const formData = {
        previsionnel: 120,
        revise: 110,
        delta: 10,
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBe(10);
    });

    it("should calculate restant correctly", () => {
      const formData = {
        previsionnel: 120,
        consomme: 50,
        get restant() {
          return this.previsionnel - this.consomme;
        },
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.restant).toBe(70);
    });

    it("should calculate both delta and restant when all values present", () => {
      const formData = {
        previsionnel: 120,
        revise: 110,
        consomme: 50,
        get restant() {
          return this.previsionnel - this.consomme;
        },
        get delta() {
          return this.previsionnel - this.revise;
        },
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBe(10);
      expect(formData.restant).toBe(70);
    });

    it("should handle negative delta", () => {
      const formData = {
        previsionnel: 100,
        revise: 120,
        get delta() {
          return this.previsionnel - this.revise;
        },
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBe(-20);
    });

    it("should handle zero delta", () => {
      const formData = {
        previsionnel: 110,
        revise: 110,
        get delta() {
          return this.previsionnel - this.revise;
        },
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBe(0);
    });

    it("should handle missing previsionnel for delta", () => {
      const formData = {
        revise: 110,
        delta: undefined,
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBeUndefined();
    });

    it("should handle missing revise for delta", () => {
      const formData = {
        previsionnel: 120,
        delta: undefined,
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBeUndefined();
    });

    it("should handle missing consomme for restant", () => {
      const formData = {
        previsionnel: 120,
        restant: undefined,
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.restant).toBeUndefined();
    });

    it("should handle zero restant", () => {
      const formData = {
        previsionnel: 100,
        consomme: 100,
        get restant() {
          return this.previsionnel - this.consomme;
        },
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.restant).toBe(0);
    });

    it("should handle negative restant (overconsumption)", () => {
      const formData = {
        previsionnel: 100,
        consomme: 150,
        get restant() {
          return this.previsionnel - this.consomme;
        },
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.restant).toBe(-50);
    });

    it("should handle decimal values", () => {
      const formData = {
        previsionnel: 120.5,
        revise: 110.3,
        consomme: 50.7,
        delta: undefined,
        restant: undefined,
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBeCloseTo(10.2, 5);
      expect(formData.restant).toBeCloseTo(69.8, 5);
    });

    it("should not modify delta if revise is 0", () => {
      const formData = {
        previsionnel: 120,
        revise: 0,
        get delta() {
          return this.previsionnel - this.revise;
        },
      };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBe(120);
    });

    it("should handle missing values gracefully", () => {
      const formData = { previsionnel: 120, delta: undefined, restant: undefined };

      component.updateCalculatedFields(formData as any);

      expect(formData.delta).toBeUndefined();
      expect(formData.restant).toBeUndefined();
    });
  });

  describe("handlePaste", () => {
    beforeEach(() => {
      component.services = [
        { id: "1", nom: "Service 1", departement_id: "dept1" },
        { id: "2", nom: "Service 2", departement_id: "dept1" },
      ];
      component.chiffres = new Map([
        [1, { initial: undefined, revise: undefined, previsionnel: undefined, consomme: undefined }],
        [2, { initial: undefined, revise: undefined, previsionnel: undefined, consomme: undefined }],
      ]);
    });

    it("should parse pasted values correctly", () => {
      const event = new ClipboardEvent("paste", {
        clipboardData: new DataTransfer(),
      });

      // Simulate Excel paste: 100\t110\t120\t50\n200\t210\t220\t100
      event.clipboardData?.setData("text/plain", "100\t110\t120\t50\n200\t210\t220\t100");
      spyOn(event, "preventDefault");

      component.handlePaste(event, 1);

      expect(event.preventDefault).toHaveBeenCalled();

      const formData1 = component.chiffres.get(1);
      expect(formData1?.initial).toBe(100);
      expect(formData1?.revise).toBe(110);
      expect(formData1?.previsionnel).toBe(120);
      expect(formData1?.consomme).toBe(50);

      const formData2 = component.chiffres.get(2);
      expect(formData2?.initial).toBe(200);
      expect(formData2?.revise).toBe(210);
      expect(formData2?.previsionnel).toBe(220);
      expect(formData2?.consomme).toBe(100);
    });

    it("should handle comma as decimal separator", () => {
      const event = new ClipboardEvent("paste", {
        clipboardData: new DataTransfer(),
      });

      event.clipboardData?.setData("text/plain", "100,5\t110,5\t120,5\t50,5");
      spyOn(event, "preventDefault");

      component.handlePaste(event, 1);

      const formData = component.chiffres.get(1);
      expect(formData?.initial).toBe(100.5);
      expect(formData?.revise).toBe(110.5);
    });
  });

  describe("save", () => {
    beforeEach(() => {
      component.idProjet = 1;
      component.chiffres = new Map([
        [
          1,
          {
            initial: 100,
            revise: 110,
            previsionnel: 120,
            consomme: 50,
            date_mise_a_jour: "2024-01-15",
          },
        ],
      ]);
    });

    it("should create new chiffres when id_chiffres is undefined", async () => {
      const newChiffre: Chiffre = {
        id_chiffres: 1,
        id_projet: 1,
        id_service: 1,
        initial: 100,
        revise: 110,
        previsionnel: 120,
        consomme: 50,
        date_mise_a_jour: "2024-01-15",
      };

      chiffresService.createChiffre.and.returnValue(Promise.resolve(newChiffre));
      spyOn(component.saved, "emit");

      await component.save();

      expect(chiffresService.createChiffre).toHaveBeenCalled();
      expect(component.saved.emit).toHaveBeenCalledWith([newChiffre]);
    });

    it("should update existing chiffres when id_chiffres is defined", async () => {
      const formData = component.chiffres.get(1);
      if (formData) {
        formData.id_chiffres = 999;
      }

      const updatedChiffre: Chiffre = {
        id_chiffres: 999,
        id_projet: 1,
        id_service: 1,
        initial: 100,
        revise: 110,
        previsionnel: 120,
        consomme: 50,
        date_mise_a_jour: "2024-01-15",
      };

      chiffresService.updateChiffre.and.returnValue(Promise.resolve(updatedChiffre));
      spyOn(component.saved, "emit");

      await component.save();

      expect(chiffresService.updateChiffre).toHaveBeenCalled();
      expect(component.saved.emit).toHaveBeenCalledWith([updatedChiffre]);
    });

    it("should skip chiffres with no data", async () => {
      component.chiffres = new Map([
        [1, { initial: undefined, revise: undefined, previsionnel: undefined, consomme: undefined }],
      ]);

      spyOn(component.saved, "emit");

      await component.save();

      expect(chiffresService.createChiffre).not.toHaveBeenCalled();
      expect(component.saved.emit).toHaveBeenCalledWith([]);
    });
  });

  describe("updateRAF", () => {
    beforeEach(() => {
      component.idProjet = 1;
      component.chiffres = new Map([[1, { raf: undefined, raf_date: undefined }]]);
      component.rafDate = "2024-01-15";
    });

    it("should fetch and update RAF", async () => {
      chiffresService.getRAFByDate.and.returnValue(Promise.resolve(250));

      await component.updateRAF(1);

      expect(chiffresService.getRAFByDate).toHaveBeenCalledWith(1, 1, "2024-01-15T00:00:00");

      const formData = component.chiffres.get(1);
      expect(formData?.raf).toBe(250);
      expect(formData?.raf_date).toBe("2024-01-15");
    });

    it("should handle RAF calculation error", async () => {
      chiffresService.getRAFByDate.and.returnValue(Promise.reject(new Error("RAF error")));

      await component.updateRAF(1);

      expect(component.chiffres.get(1)?.raf).toBeUndefined();
    });
  });

  describe("onValueChange", () => {
    it("should update calculated fields when value changes", () => {
      component.chiffres = new Map([
        [
          1,
          {
            previsionnel: 120,
            revise: 110,
            consomme: 50,
            delta: undefined,
            restant: undefined,
          },
        ],
      ]);

      component.onValueChange(1, "previsionnel");

      const formData = component.chiffres.get(1);
      expect(formData?.delta).toBe(10);
      expect(formData?.restant).toBe(70);
    });

    it("should handle non-existent service id", () => {
      component.chiffres = new Map([[1, { previsionnel: 120, revise: 110 }]]);

      expect(() => {
        component.onValueChange(999, "previsionnel");
      }).not.toThrow();
    });
  });

  describe("calculateTotal", () => {
    beforeEach(() => {
      component.chiffres = new Map([
        [1, { initial: 100, revise: 110, previsionnel: 120, consomme: 50, delta: 10, restant: 70 }],
        [2, { initial: 200, revise: 220, previsionnel: 240, consomme: 100, delta: 20, restant: 140 }],
      ]);
    });

    it("should calculate total initial correctly", () => {
      const total = component.calculateTotal("initial");
      expect(parseFloat(total)).toBe(300);
    });

    it("should calculate total delta correctly", () => {
      const total = component.calculateTotal("delta");
      expect(parseFloat(total)).toBe(30);
    });

    it("should calculate total restant correctly", () => {
      const total = component.calculateTotal("restant");
      expect(parseFloat(total)).toBe(210);
    });

    it("should handle undefined values in total calculation", () => {
      component.chiffres = new Map([
        [1, { initial: 100, revise: undefined, delta: undefined }],
        [2, { initial: 200, revise: 220, delta: 20 }],
      ]);

      const total = component.calculateTotal("delta");
      expect(parseFloat(total)).toBe(20);
    });

    it("should return zero for empty map", () => {
      component.chiffres.clear();
      const total = component.calculateTotal("initial");
      expect(parseFloat(total)).toBe(0);
    });
  });
});
