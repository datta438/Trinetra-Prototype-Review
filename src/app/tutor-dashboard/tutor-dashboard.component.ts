import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-tutor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard">
      <header>
        <h1>Tutor Dashboard</h1>
        <button type="button" class="logout" (click)="supabase.logout()">Logout</button>
      </header>
      
      <!-- REAL TIME FRICTION NOTIFICATIONS -->
      <div class="notifications-panel">
        <h3>🔴 Live Friction Alerts</h3>
        <p *ngIf="notifications().length === 0" class="empty">No active struggles detected.</p>
        <div class="alert-card" *ngFor="let alert of notifications()" [ngClass]="alert.friction_type">
          <strong>{{alert.student_name}}</strong> triggered <span>{{alert.friction_type}}</span><br/>
          <small>Subject: {{alert.subject_title}} | Video: {{alert.video_title}} (at {{alert.timestamp_seconds}}s)</small><br/>
          <small class="time">{{alert.created_at | date:'shortTime'}}</small>
        </div>
      </div>

      <div class="content">
        <div class="card">
          <h3>Create New Subject</h3>
          <div style="display: flex; gap: 10px;">
            <input type="text" [(ngModel)]="newSubjectTitle" placeholder="Physics - Newton's Laws" style="flex: 1;" />
            <button type="button" (click)="createSubject()">Create</button>
          </div>
        </div>

        <!-- List Subjects & Add Videos -->
        <div class="subject-card" *ngFor="let sub of subjects()">
          <h3>{{sub.title}}</h3>
          <div class="video-list">
            <p *ngIf="!sub.videos?.length">No videos added yet.</p>
            <li *ngFor="let vid of sub.videos">{{vid.title}}</li>
          </div>
          
          <div class="add-video-form">
            <input type="text" [(ngModel)]="sub.newVideoTitle" placeholder="Video Title" />
            <input type="text" [(ngModel)]="sub.newVideoUrl" placeholder="YouTube URL" />
            <button type="button" (click)="addVideo(undefined, sub)">Add Video</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { padding: 20px; font-family: sans-serif; background: #F3F4F6; min-height: 100vh; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .logout { background: #DC2626; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor:pointer;}
    .notifications-panel { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #DC2626; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .alert-card { padding: 10px; margin-bottom: 10px; border-radius: 6px; font-size: 14px; background: #FEF2F2; color: #991B1B;}
    .alert-card.Surface { background: #FFFBEB; color: #92400E; }
    .card, .subject-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    input { padding: 8px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px;}
    button { padding: 8px 16px; background: #2563EB; color: white; border: none; border-radius: 4px; cursor: pointer;}
    .add-video-form { margin-top: 15px; display: flex; gap: 10px; }
  `]
})
export class TutorDashboardComponent implements OnInit {
  supabase = inject(SupabaseService);
  subjects = signal<any[]>([]);
  notifications = signal<any[]>([]);
  newSubjectTitle = '';

  async ngOnInit() {
    // Ensure user is loaded on direct navigation
    if (!this.supabase.currentUser()) {
      const { data } = await this.supabase.supabase.auth.getUser();
      this.supabase.currentUser.set(data.user);
    }
    await this.loadSubjects();
    this.listenToFriction();
  }

  async loadSubjects() {
    const user = this.supabase.currentUser();
    if (!user) return;
    const { data: subs, error } = await this.supabase.supabase
      .from('subjects').select('*, videos(*)').eq('tutor_id', user.id);
    if (error) {
      alert("Error loading subjects: " + error.message);
      console.error(error);
    }
    this.subjects.set(subs || []);
  }

  async createSubject(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    console.log('Title entered:', this.newSubjectTitle);

    if (!this.newSubjectTitle) {
      alert('Please enter a subject title');
      return;
    }
    const user = this.supabase.currentUser();
    console.log('Current user session:', user);

    if (!user) {
      alert('User session not found.');
      return;
    }

    console.log('Attempting DB insert for subject...');
    const { error } = await this.supabase.supabase.from('subjects').insert({
      tutor_id: user.id, title: this.newSubjectTitle
    });

    console.log('DB insert error:', error);
    if (error) {
      alert("Error creating subject: " + error.message);
      return;
    }

    this.newSubjectTitle = '';
    await this.loadSubjects();
    alert("Subject created successfully!");
  }

  async addVideo(event: Event | undefined, subject: any) {
    if (event) {
      event.preventDefault();
    }
    console.log('Video url entered:', subject.newVideoUrl);

    if (!subject.newVideoTitle || !subject.newVideoUrl) {
      alert("Please enter a Video Title and YouTube URL");
      return;
    }
    // Extract YT ID robustly using a Regex for any format
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = subject.newVideoUrl.match(regExp);
    const ytId = (match && match[2].length === 11) ? match[2] : subject.newVideoUrl;

    console.log('Extracted YouTube ID:', ytId);
    const { error } = await this.supabase.supabase.from('videos').insert({
      subject_id: subject.id, title: subject.newVideoTitle, youtube_url: subject.newVideoUrl, youtube_id: ytId
    });

    console.log('DB insert error:', error);
    if (error) {
      alert("Error adding video: " + error.message);
      return;
    }

    subject.newVideoTitle = '';
    subject.newVideoUrl = '';
    await this.loadSubjects();
    alert("Video added successfully!");
  }

  listenToFriction() {
    const user = this.supabase.currentUser();
    if (!user) return;
    console.log('Starting Realtime subscription for Tutor:', user.id);
    // Supabase Realtime Magic
    this.supabase.supabase.channel('friction-alerts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'friction_logs',
        filter: `tutor_id=eq.${user.id}`
      }, (payload: any) => {
        console.log('Realtime Payload Received!', payload);
        this.notifications.update(current => [payload.new, ...current]);
      }).subscribe((status) => {
        console.log('Subscription status:', status);
      });
  }
}
