import { Component, AfterViewInit, inject, signal, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';

declare var Canny: any;

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.css',
})
export class FeedbackComponent implements AfterViewInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly ngZone = inject(NgZone);
  protected readonly sdkFailed = signal(false);

  ngAfterViewInit() {
    const self = this;

    // Function to render Canny
    const renderCanny = () => {
      try {
        if (!environment.cannyBoardToken) {
          console.warn('Canny board token is not configured.');
          return;
        }
        Canny('render', {
          boardToken: environment.cannyBoardToken,
          basePath: null,
          theme: 'auto',
        });
      } catch (err) {
        console.error('Failed to initialize Canny widget render:', err);
        self.ngZone.run(() => {
          self.sdkFailed.set(true);
        });
      }
    };

    // If no board token, mark as failed immediately (or handle gracefully)
    if (!environment.cannyBoardToken) {
      this.sdkFailed.set(true);
      return;
    }

    // 1. If Canny SDK is already fully loaded (not just the stub)
    if (typeof Canny === 'function' && (Canny as any).q === undefined) {
      renderCanny();
      return;
    }

    // 2. Initialize Canny queue if not already present
    if (typeof (window as any).Canny !== 'function') {
      const c = function() {
        (c as any).q.push(arguments);
      };
      (c as any).q = [];
      (window as any).Canny = c;
    }

    // 3. Load the Canny script tag immediately if not already present
    const scriptId = 'canny-jssdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://sdk.canny.io/sdk.js';

      script.onload = () => {
        renderCanny();
      };

      script.onerror = () => {
        self.ngZone.run(() => {
          self.sdkFailed.set(true);
        });
      };

      // Appending outside Angular Zone to prevent Zone.js from intercepting network/loading errors
      this.ngZone.runOutsideAngular(() => {
        document.head.appendChild(script);
      });
    } else {
      // If the script tag is already there but not yet loaded, wait for it
      if (typeof Canny === 'function' && (Canny as any).q !== undefined) {
        const existingOnload = script.onload;
        script.onload = (ev) => {
          if (existingOnload) (existingOnload as any)(ev);
          renderCanny();
        };
      } else {
        renderCanny();
      }
    }
  }
}
