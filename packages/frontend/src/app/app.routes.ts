import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DashboardPagosComponent } from './dashboard/dashboard-pagos.component';
import { DashboardHistorialComponent } from './dashboard/dashboard-historial.component';
import { DashboardVerificarComponent } from './dashboard/dashboard-verificar.component';
import { DashboardCertificadosComponent } from './dashboard/dashboard-certificados.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { WalletCredentialsComponent } from './wallet-credentials/wallet-credentials.component';
import { authGuard } from './auth/auth.guard';
import { loginGuard } from './auth/login.guard';
import { SubirPdfComponent } from './Subir_pdf/subir-pdf.component';
import { EnviarDineroComponent } from './Enviar_dinero/enviar-dinero.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginGuard],
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [loginGuard],
  },
  {
    path: 'wallet-credentials',
    component: WalletCredentialsComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pagos' },
      { path: 'pagos', component: DashboardPagosComponent },
      { path: 'historial', component: DashboardHistorialComponent },
      { path: 'verificar', component: DashboardVerificarComponent },
      { path: 'certificados', component: DashboardCertificadosComponent },
      { path: 'subir-pdf', component: SubirPdfComponent },
      { path: 'enviar-dinero', component: EnviarDineroComponent },
    ],
  },
  {
    path: 'subir-pdf',
    redirectTo: '/dashboard/subir-pdf',
    pathMatch: 'full',
  },
  {
    path: 'enviar-dinero',
    redirectTo: '/dashboard/enviar-dinero',
    pathMatch: 'full',
  },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
