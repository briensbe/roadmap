import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

const MESSAGES: string[][] = [
  [
    "Congratulations!",
    "You found the",
    "only \"Easter Egg\"",
    "of da Tutti Viewer! ;)!"
  ],
  [
    "So what do you win?",
    "My credit card code?...",
    "...no!"
  ],
  [
    "Just a little",
    "word from \"Fuj\"",
    "(so,... who am I?  :o)"
  ],
  [
    "\"Big-Up\" to the",
    "whole Netfinca team",
    "I worked with",
    "from 2001 to 2003!"
  ],
  [
    "\"Tout de bon\"",
    "to all of you and",
    "to the Netfinca project"
  ]
];

class ColumnEffect {
  private currentColor: { r: number; g: number; b: number };
  private originalColor: { r: number; g: number; b: number };
  private frameCount = 0;
  private isDoneInFade = false;

  constructor(
    private goals: string[],
    private x: number,
    private y: number,
    private numberOfLetters: number,
    color: { r: number; g: number; b: number },
    private fontSize: number,
    private width: number,
    private height: number,
    private speed: number,
    private beginFadeOut: number
  ) {
    this.originalColor = { ...color };
    this.currentColor = { ...color };
  }

  reset(newGoals: string[], fadeStart: number) {
    this.goals = newGoals;
    this.currentColor = { ...this.originalColor };
    this.frameCount = 0;
    this.beginFadeOut = fadeStart;
    this.isDoneInFade = false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.frameCount++;
    const dec = this.frameCount;
    const offset = dec * this.speed;

    // Fading logic
    if (offset > this.beginFadeOut) {
      if (this.currentColor.b > 0) this.currentColor.b--;
      if (this.currentColor.r > 0) this.currentColor.r--;
      if (this.currentColor.g > 0) this.currentColor.g -= 3; // Slower fade for better readability
      if (this.currentColor.g < 0) this.currentColor.g = 0;
    }

    const { r, g, b } = this.currentColor;
    if (r !== 0 || g !== 0 || b !== 0) {
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      for (let i = 0; i < this.numberOfLetters; i++) {
        if (i === 0) {
          ctx.font = `bold ${this.fontSize + 1}px monospace`;
        } else {
          ctx.font = `${this.fontSize}px monospace`;
        }
        
        const randomChar = String.fromCharCode(Math.floor(Math.random() * (130 - 65) + 65));
        const posY = this.y - (i * this.height + 1) + offset;
        ctx.fillText(randomChar, this.x, posY);
      }
    } else {
      this.isDoneInFade = true;
    }

    // The letters that stay (reveal)
    if (offset > this.beginFadeOut) {
      const lineToBeginIn = Math.ceil((Math.ceil(ctx.canvas.height / this.height) - this.goals.length) / 2) + 1;
      ctx.font = `${this.fontSize}px monospace`;
      ctx.fillStyle = `rgb(${this.originalColor.r}, ${this.originalColor.g}, ${this.originalColor.b})`;
      
      let newY = lineToBeginIn * this.height + 1;
      for (const char of this.goals) {
        if (char && char !== ' ') {
          ctx.fillText(char, this.x, newY);
        }
        newY += this.height + 1;
      }
    }
  }

  isFinished(): boolean {
    return this.isDoneInFade;
  }
}

@Component({
  selector: 'app-matrix-easter-egg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="closeEffect()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <button class="close-icon-floating" (click)="closeEffect()">&times;</button>
        <div class="canvas-container" #container>
          <canvas #canvas></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      backdrop-filter: blur(10px);
    }
    .modal-card {
      background: black;
      border: 2px solid #00ff46;
      border-radius: 8px;
      width: 80%;
      max-width: 800px;
      height: 60vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 40px rgba(0, 255, 70, 0.6);
      overflow: hidden;
      position: relative;
      animation: zoomIn 0.3s ease-out;
    }
    .close-icon-floating {
      position: absolute;
      top: 10px;
      right: 15px;
      background: none;
      border: none;
      color: #00ff46;
      font-size: 32px;
      cursor: pointer;
      line-height: 1;
      z-index: 10;
      transition: all 0.2s;
      text-shadow: 0 0 10px rgba(0, 255, 70, 0.8);
    }
    .close-icon-floating:hover {
      color: white;
      transform: scale(1.1);
    }
    .canvas-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    canvas {
      display: block;
    }
    @keyframes zoomIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class MatrixEasterEggComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @Output() close = new EventEmitter<void>();

  private ctx!: CanvasRenderingContext2D;
  private columns: ColumnEffect[] = [];
  private animationId?: number;
  private currentMessageIndex = 0;
  private isWaitingForNext = false;

  ngOnInit() {
    setTimeout(() => {
        this.initCanvas();
        this.createColumns();
        this.animate();
    }, 100);
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  @HostListener('window:keydown.escape')
  closeEffect() {
    this.close.emit();
  }

  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const container = this.containerRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  private getGoalsForCurrentMessage(colIndex: number): string[] {
    const currentMsg = MESSAGES[this.currentMessageIndex];
    const colWidth = 20;
    const canvasWidth = this.canvasRef.nativeElement.width;
    const numCols = Math.floor(canvasWidth / colWidth);
    
    // Find the longest line in the current message
    const maxLineLen = Math.max(...currentMsg.map(l => l.length));
    
    // Calculate the left padding in terms of columns to center the block
    const paddingLeftCols = Math.floor((numCols - maxLineLen) / 2);
    
    const relativeCol = colIndex - paddingLeftCols;
    
    return currentMsg.map(line => {
      if (relativeCol >= 0 && relativeCol < line.length) {
        return line[relativeCol];
      }
      return ' ';
    });
  }

  private createColumns() {
    const fontSize = 16;
    const colWidth = 20;
    const canvas = this.canvasRef.nativeElement;
    const numCols = Math.ceil(canvas.width / colWidth);

    for (let i = 0; i < numCols; i++) {
        const speed = 2 + Math.random() * 4;
        const fadeStart = canvas.height * 0.3 + Math.random() * (canvas.height * 0.4);
        const numLetters = 10 + Math.floor(Math.random() * 10);
        const goals = this.getGoalsForCurrentMessage(i);

        this.columns.push(new ColumnEffect(
            goals,
            i * colWidth,
            0,
            numLetters,
            { r: 0, g: 255, b: 70 },
            fontSize,
            colWidth,
            fontSize + 4,
            speed,
            fadeStart
        ));
    }
  }

  private animate() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    let allFinished = true;
    for (const column of this.columns) {
      column.draw(this.ctx);
      if (!column.isFinished()) {
        allFinished = false;
      }
    }

    if (allFinished && !this.isWaitingForNext) {
        this.isWaitingForNext = true;
        setTimeout(() => this.nextMessage(), 2500);
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  private nextMessage() {
    this.currentMessageIndex++;
    if (this.currentMessageIndex >= MESSAGES.length) {
        // Last message shown, wait a bit and close or loop
        setTimeout(() => this.close.emit(), 3000);
        return;
    }

    const canvas = this.canvasRef.nativeElement;
    for (let i = 0; i < this.columns.length; i++) {
        const goals = this.getGoalsForCurrentMessage(i);
        const fadeStart = canvas.height * 0.3 + Math.random() * (canvas.height * 0.4);
        this.columns[i].reset(goals, fadeStart);
    }
    this.isWaitingForNext = false;
  }
}
