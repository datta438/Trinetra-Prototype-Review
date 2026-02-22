import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="card">
        <h2>Trinetra {{ isLogin() ? 'Login' : 'Sign Up' }}</h2>
        
        <form (submit)="onSubmit($event)">
          <div *ngIf="!isLogin()" class="form-group">
            <label>Full Name</label>
            <input type="text" [(ngModel)]="fullName" name="name" required />
          </div>

          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" name="email" required />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" name="password" required />
          </div>

          <div *ngIf="!isLogin()" class="form-group">
            <label>I am a:</label>
            <select [(ngModel)]="role" name="role">
              <option value="student">Student</option>
              <option value="tutor">Tutor</option>
            </select>
          </div>

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Processing...' : (isLogin() ? 'Login' : 'Sign Up') }}
          </button>
        </form>
        
        <p class="toggle" (click)="isLogin.set(!isLogin())">
          {{ isLogin() ? 'Need an account? Sign Up' : 'Already have an account? Login' }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container { display: flex; justify-content: center; padding-top: 100px; font-family: sans-serif; }
    .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 350px; }
    h2 { color: #1E3A8A; text-align: center; margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-size: 14px; }
    input, select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #2563EB; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:disabled { background: #94A3B8; }
    .toggle { text-align: center; margin-top: 15px; color: #2563EB; cursor: pointer; font-size: 14px;}
  `]
})
export class AuthComponent {
  supabase = inject(SupabaseService);
  isLogin = signal(true);
  loading = signal(false);

  email = '';
  password = '';
  fullName = '';
  role = 'student';

  async onSubmit(e: Event) {
    e.preventDefault();
    this.loading.set(true);
    console.log('Login attempt started for:', this.email);
    try {
      if (this.isLogin()) {
        const { data, error } = await this.supabase.supabase.auth.signInWithPassword({ email: this.email, password: this.password });
        console.log('Login result:', data, error);
        if (error) {
          alert('Login Error: ' + error.message);
          this.loading.set(false);
        } else if (data.user) {
          // Manual route navigation
          const { data: profile } = await this.supabase.supabase.from('profiles').select('*').eq('id', data.user.id).single();
          if (profile) {
            this.supabase.userProfile.set(profile);
            if (profile.role === 'tutor') this.supabase.router.navigate(['/tutor']);
            else this.supabase.router.navigate(['/student']);
          } else {
            console.error('No profile found for user!');
            this.loading.set(false);
          }
        }
      } else {
        const { error } = await this.supabase.supabase.auth.signUp({
          email: this.email,
          password: this.password,
          options: { data: { full_name: this.fullName, role: this.role } }
        });
        if (error) {
          alert('Signup Error: ' + error.message);
          this.loading.set(false);
        } else {
          alert('Signup successful! Auto-logging in...');
          if (this.role === 'tutor') this.supabase.router.navigate(['/tutor']);
          else this.supabase.router.navigate(['/student']);
        }
      }
    } catch (err) {
      console.error('Catch block error:', err);
      this.loading.set(false);
    }
  }
}
