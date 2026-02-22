import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { TutorDashboardComponent } from './tutor-dashboard/tutor-dashboard.component';
import { StudentDashboardComponent } from './student-dashboard/student-dashboard.component';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: AuthComponent },
    { path: 'tutor', component: TutorDashboardComponent },
    { path: 'student', component: StudentDashboardComponent },
];
