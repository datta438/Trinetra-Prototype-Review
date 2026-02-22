import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { Router } from '@angular/router';
import { NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  public supabase: SupabaseClient;
  public currentUser = signal<User | null>(null);
  public userProfile = signal<any>(null);

  constructor(public router: Router, private ngZone: NgZone) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Listen to Auth State Changes
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      this.ngZone.run(async () => {
        console.log('Auth State Changed:', event, session?.user?.id);

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          this.currentUser.set(session?.user ?? null);
          if (session?.user) {
            const { data } = await this.supabase.from('profiles').select('*').eq('id', session.user.id).single();
            this.userProfile.set(data);

            if (event === 'INITIAL_SESSION' && (this.router.url === '/login' || this.router.url === '/')) {
              if (data?.role === 'tutor') this.router.navigate(['/tutor']);
              else if (data?.role === 'student') this.router.navigate(['/student']);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          this.currentUser.set(null);
          this.userProfile.set(null);
          this.router.navigate(['/login']);
        }
      });
    });
  }

  async logout() {
    console.log('Logout clicked - clearing session');
    this.currentUser.set(null);
    this.userProfile.set(null);
    await this.supabase.auth.signOut();
    this.router.navigate(['/login']);
  }
}
