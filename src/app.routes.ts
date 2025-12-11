import { Routes } from "@angular/router";
import { CalendarViewComponent } from "./components/calendar-view.component";
import { OrganizationViewComponent } from "./components/organization-view.component";
import { ResourceManagerComponent } from "./components/resource-manager.component";
import { CapacityViewComponent } from "./components/capacity-view.component";
import { ProjectsViewComponent } from "./components/projects-view.component";
import { PlanViewComponent } from "./components/plan-view.component";
import { MilestonesViewComponent } from "./components/milestones-view.component";
import { LoginComponent } from "./auth/login/login.component";
import { SignupComponent } from "./auth/signup/signup.component";
import { ForgotPasswordComponent } from "./auth/forgot-password/forgot-password.component";
import { AuthGuard } from "./guards/auth.guard";
import { ProfileComponent } from "./auth/profile/profile.component";
import { UpdatePasswordComponent } from "./auth/update-password/update-password.component";

export const routes: Routes = [
  { path: "login", component: LoginComponent },
  { path: "signup", component: SignupComponent },
  { path: "forgot-password", component: ForgotPasswordComponent },
  {
    path: "",
    canActivate: [AuthGuard],
    children: [
      { path: "", redirectTo: "/plan-globale", pathMatch: "full" },
      { path: "planification", component: CalendarViewComponent },
      { path: "organisation", component: OrganizationViewComponent },
      { path: "ressources", component: ResourceManagerComponent },
      { path: "capacite", component: CapacityViewComponent },
      { path: "projets", component: ProjectsViewComponent },
      { path: "plan-globale", component: PlanViewComponent },
      { path: "jalons", component: MilestonesViewComponent },
      { path: "profile", component: ProfileComponent },
      { path: "update-password", component: UpdatePasswordComponent },
    ],
  },
  { path: "**", redirectTo: "login" },
];
