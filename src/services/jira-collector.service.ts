import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class JiraCollectorService {
  private readonly ngZone = inject(NgZone);
  private scriptLoaded = false;

  loadAndShow(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If Jira url is not specified, resolve immediately
      if (!environment.jiraCollectorUrl) {
        resolve();
        return;
      }

      // 1. If script is already in document, resolve immediately
      const scriptId = 'jira-issue-collector';
      if (this.scriptLoaded || document.getElementById(scriptId)) {
        resolve();
        return;
      }

      // 2. Create the script element
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'text/javascript';
      script.async = true;
      script.src = environment.jiraCollectorUrl;

      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };

      script.onerror = (err) => {
        reject(err);
      };

      // 3. Inject outside Angular zone to prevent Zone.js global error tracking issues
      this.ngZone.runOutsideAngular(() => {
        document.head.appendChild(script);
      });
    });
  }
}
