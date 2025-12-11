import { Component, inject } from "@angular/core";
import { SupabaseService } from "../../services/supabase.service";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { Router } from '@angular/router';

@Component({
  selector: "app-forgot-password",
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: "./forgot-password.component.html",
  styleUrl: "./forgot-password.component.css",
})
export class ForgotPasswordComponent {
  email = "";
  message = "";
  loading = false;
    
  private readonly router = inject(Router);

  constructor(private supabaseService: SupabaseService) {}

  async onSubmit() {
    this.loading = true;
    try {
      await this.supabaseService.resetPasswordForEmail(this.email);
      this.message = "Un lien de réinitialisation a été envoyé à votre adresse email.";
    } catch (error: any) {
      this.message = `Erreur : ${error.message}`;
    } finally {
      this.loading = false;
    }
  }

  navigateToLogin() {
    this.router.navigate(["/login"]);
  }
}
