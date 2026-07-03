import { Routes } from '@angular/router';
import { OrganizationViewComponent } from './components/organization-view.component';
import { ResourceManagerComponent } from './components/resource-manager.component';
import { CapacityViewComponent } from './components/capacity-view/capacity-view.component';
import { ProjectsViewComponent } from './components/projects/projects-view.component';
import { PlanViewComponent } from './components/plan-view/plan-view.component';
import { MilestonesViewComponent } from './components/milestones-view.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DashboardSprintsComponent } from './components/dashboard-sprints/dashboard-sprints.component';
import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password.component';
import { AuthGuard } from './guards/auth.guard';
import { ProfileComponent } from './auth/profile/profile.component';
import { UpdatePasswordComponent } from './auth/update-password/update-password.component';
import { GuideComponent } from './components/guide/guide.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'charges-sprints', component: DashboardSprintsComponent },
      { path: 'organisation', component: OrganizationViewComponent },
      { path: 'ressources', component: ResourceManagerComponent },
      { path: 'capacite', component: CapacityViewComponent },
      { path: 'projets', component: ProjectsViewComponent },
      { path: 'planification', component: PlanViewComponent },
      { path: 'jalons', component: MilestonesViewComponent },
      {
        path: 'imports',
        loadComponent: () =>
          import('./components/import-view/import-view.component').then((m) => m.ImportViewComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./components/settings/settings.component').then((m) => m.SettingsComponent),
      },
      { path: 'profile', component: ProfileComponent },
      { path: 'guide', component: GuideComponent },
      { path: 'update-password', component: UpdatePasswordComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
