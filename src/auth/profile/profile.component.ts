import { Component, inject, OnInit } from "@angular/core";
import { SupabaseService } from "../../services/supabase.service";
// import { ThemeService, type Theme } from "../services/theme.service";
import { LucideAngularModule } from "lucide-angular";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { User } from "../types/user.type";
// import { ProfileTutorialService } from "../../services/profiletutorial.service";

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [LucideAngularModule, CommonModule],
  templateUrl: "./profile.component.html",
  styleUrl: "./profile.component.css",
})
export class ProfileComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  public readonly user = this.supabaseService.user;
  loading = false;
  showInfo = false;
  private readonly router = inject(Router);
//désactivation de la partie darkmode
  /*
  public readonly themeService = inject(ThemeService);

  // Theme options for the selector  
  themeOptions: Array<{ value: Theme; label: string; icon: string }> = [
    { value: 'light', label: 'Clair', icon: 'sun' },
    { value: 'dark', label: 'Sombre', icon: 'moon' },
    { value: 'system', label: 'Navigateur', icon: 'monitor' },
  ];
*/
  ngOnInit() {
  }
    
  //Désactivation de la partie tuto
/*
  constructor(private tuto: ProfileTutorialService) {}

  ngOnInit() {
     this.tuto.init();
  }

  
  replayTutorial() {
    this.tuto.startTutorial(); // relance le tutoriel à la demande
  }
    */

  async toggleUserInfo() {
    if (this.user()) {
      this.showInfo = !this.showInfo;
    } else {
      await this.fetchUser();
      this.showInfo = true;
    }
  }

  async fetchUser() {
    this.loading = true;
    try {
      const { data } = await this.supabaseService.getUser();
      // Le signal se met à jour automatiquement via getUser() ou le listener

      if (!data?.user) {
        this.router.navigate(["/login"]);
      }
    } finally {
      this.loading = false;
    }
  }
  async signOut() {
    await this.supabaseService.signOut();
    this.router.navigate(["/login"]);
  }

  async updatePassword() {
    // await this.supabaseService.signOut();
    this.router.navigate(["/update-password"]);
  }

  // désactivation de la partie Darkmode
  /*
  toggleTheme() {
    this.themeService.toggleTheme();
  }

  setTheme(theme: Theme) {
    this.themeService.setTheme(theme);
  }

  // Helper to get current theme preference
  getCurrentTheme(): Theme {
    return this.themeService.getThemePreference()();
  }
    */
}
