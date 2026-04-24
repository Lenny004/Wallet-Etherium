import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
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
	},
	{
		path: 'subir-pdf',
		component: SubirPdfComponent,
		canActivate: [authGuard],
	},
	{
		path: 'enviar-dinero',
		component: EnviarDineroComponent,
		canActivate: [authGuard],
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
