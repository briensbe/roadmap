import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectionToolbarComponent } from './selection-toolbar.component';
import { By } from '@angular/platform-browser';

describe('SelectionToolbarComponent', () => {
  let component: SelectionToolbarComponent;
  let fixture: ComponentFixture<SelectionToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectionToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectionToolbarComponent);
    component = fixture.componentInstance;
    component.visible = true;
    component.totalDays = 12.5;
    component.selectedCount = 3;
    component.value = 2.5;
    fixture.detectChanges();
  });

  it('should create SelectionToolbarComponent', () => {
    expect(component).toBeTruthy();
  });

  describe('Standard editable mode (readOnly = false)', () => {
    beforeEach(() => {
      component.readOnly = false;
      fixture.detectChanges();
    });

    it('should display selection info summary', () => {
      const infoEl = fixture.debugElement.query(By.css('.selection-info'));
      expect(infoEl).toBeTruthy();
      expect(infoEl.nativeElement.textContent).toContain('12.5j');
      expect(infoEl.nativeElement.textContent).toContain('3');
    });

    it('should display toolbar tabs and actions', () => {
      const tabs = fixture.debugElement.query(By.css('.toolbar-tabs'));
      const actions = fixture.debugElement.query(By.css('.selection-actions'));
      expect(tabs).toBeTruthy();
      expect(actions).toBeTruthy();
    });

    it('should not display close button for read-only mode in header', () => {
      const closeBtn = fixture.debugElement.query(By.css('.btn-close-readonly'));
      expect(closeBtn).toBeNull();
    });

    it('should emit cancel when onCancel is called', () => {
      spyOn(component.cancel, 'emit');
      component.onCancel();
      expect(component.cancel.emit).toHaveBeenCalled();
    });
  });

  describe('Read-only mode (readOnly = true)', () => {
    beforeEach(() => {
      component.readOnly = true;
      component.value = 3.5;
      component.showCommentField = true;
      component.comment = 'Justification test';
      component.ngOnChanges({
        visible: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false },
        comment: { currentValue: 'Justification test', previousValue: '', firstChange: false, isFirstChange: () => false },
      });
      fixture.detectChanges();
    });

    it('should apply read-only class to the toolbar root', () => {
      const root = fixture.debugElement.query(By.css('.selection-toolbar'));
      expect(root.classes['read-only']).toBeTrue();
    });

    it('should display summary info even in read-only mode', () => {
      const infoEl = fixture.debugElement.query(By.css('.selection-info'));
      expect(infoEl).toBeTruthy();
      expect(infoEl.nativeElement.textContent).toContain('12.5j');
      expect(infoEl.nativeElement.textContent).toContain('3');
    });

    it('should display the figure already entered in a disabled input', () => {
      const input = fixture.debugElement.query(By.css('input.bulk-input'));
      expect(input).toBeTruthy();
      expect(input.nativeElement.disabled).toBeTrue();
      expect(input.nativeElement.value).toBe('3.5');
    });

    it('should display the existing comment in a disabled input', () => {
      const commentInputs = fixture.debugElement.queryAll(By.css('input.comment-input'));
      expect(commentInputs.length).toBe(1);
      const commentInput = commentInputs[0]!;
      expect(commentInput.nativeElement.disabled).toBeTrue();
      expect(commentInput.nativeElement.value).toBe('Justification test');
    });

    it('should hide mutation tabs and buttons, but keep Fermer button', () => {
      const tabs = fixture.debugElement.query(By.css('.toolbar-tabs'));
      const applyBtn = fixture.debugElement.query(By.css('.btn-primary'));
      const closeActionBtn = fixture.debugElement.query(By.css('.selection-actions button'));

      expect(tabs).toBeNull();
      expect(applyBtn).toBeNull();
      expect(closeActionBtn).toBeTruthy();
      expect(closeActionBtn.nativeElement.textContent.trim()).toBe('Fermer');
    });

    it('should emit cancel when Fermer button or header close is clicked', () => {
      spyOn(component.cancel, 'emit');
      const closeActionBtn = fixture.debugElement.query(By.css('.selection-actions button'));
      closeActionBtn.nativeElement.click();
      expect(component.cancel.emit).toHaveBeenCalled();
    });

    it('should ignore onApply and onProject calls when readOnly is true', () => {
      spyOn(component.apply, 'emit');
      spyOn(component.project, 'emit');

      component.onApply();
      component.onProject();

      expect(component.apply.emit).not.toHaveBeenCalled();
      expect(component.project.emit).not.toHaveBeenCalled();
    });
  });

  describe('Crewdayz Mode in read-only', () => {
    beforeEach(() => {
      component.isCrewdayzMode = true;
      component.readOnly = true;
      component.selectedCount = 1;
      component.crewdayzBaseValue = 1;
      component.overrideValue = 1.5;
      component.comment = 'Astreinte';
      component.daysPerWeek = 5;
      component.ngOnChanges({
        visible: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false },
        comment: { currentValue: 'Astreinte', previousValue: '', firstChange: false, isFirstChange: () => false },
      });
      fixture.detectChanges();
    });

    it('should display crewdayz summary, base pill, disabled override and comment', () => {
      const basePill = fixture.debugElement.query(By.css('.crewdayz-base-pill'));
      expect(basePill).toBeTruthy();
      expect(basePill.nativeElement.textContent).toContain('1 ETP');

      const tabs = fixture.debugElement.query(By.css('.toolbar-tabs'));
      expect(tabs).toBeNull();

      const overrideInput = fixture.debugElement.query(By.css('input.bulk-input'));
      expect(overrideInput).toBeTruthy();
      expect(overrideInput.nativeElement.disabled).toBeTrue();
      expect(overrideInput.nativeElement.value).toBe('1.5');

      const commentInput = fixture.debugElement.query(By.css('input.comment-input'));
      expect(commentInput).toBeTruthy();
      expect(commentInput.nativeElement.disabled).toBeTrue();
      expect(commentInput.nativeElement.value).toBe('Astreinte');
    });

    it('should ignore onApplyOverride and onApplyDelta when readOnly is true', () => {
      spyOn(component.applyOverride, 'emit');
      spyOn(component.applyDelta, 'emit');

      component.onApplyOverride();
      component.onApplyDelta();

      expect(component.applyOverride.emit).not.toHaveBeenCalled();
      expect(component.applyDelta.emit).not.toHaveBeenCalled();
    });
  });
});
