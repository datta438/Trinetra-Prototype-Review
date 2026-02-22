import { Component, inject, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../supabase.service';
import { YouTubePlayerModule } from '@angular/youtube-player';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, YouTubePlayerModule],
  template: `
    <div class="dashboard">
      <header>
        <h1>Student Dashboard</h1>
        <button type="button" class="logout" (click)="supabase.logout()">Logout</button>
      </header>

      <!-- TABS -->
      <div class="tabs" *ngIf="!playingVideo()">
        <button (click)="tab.set('browse')" [class.active]="tab() === 'browse'">Browse Subjects</button>
        <button (click)="tab.set('mycourses')" [class.active]="tab() === 'mycourses'">My Courses</button>
      </div>

      <!-- BROWSE -->
      <div class="grid" *ngIf="tab() === 'browse' && !playingVideo()">
        <div class="card" *ngFor="let sub of allSubjects()">
          <h3>{{sub.title}}</h3>
          <button (click)="enroll(sub)">Enroll Now (Free)</button>
        </div>
      </div>

      <!-- MY COURSES -->
      <div class="grid" *ngIf="tab() === 'mycourses' && !playingVideo()">
        <div class="card" *ngFor="let sub of enrolledSubjects()">
          <h3>{{sub.title}}</h3>
          <p>Videos:</p>
          <ul style="padding-left: 20px">
            <li *ngFor="let vid of sub.videos">
              <a href="javascript:void(0)" (click)="playVideo(vid, sub)">▶ {{vid.title}}</a>
            </li>
          </ul>
        </div>
      </div>

      <!-- VIDEO PLAYER & TRACKER -->
      <div *ngIf="playingVideo()" class="player-container">
        <button class="back" (click)="playingVideo.set(null)">← Back to Courses</button>
        
        <!-- MAGIC DEMO EXPLANATION -->
        <div class="demo-tools" style="background:#F0FDF4; padding: 15px; margin-bottom: 20px; border-radius: 8px; border: 1px dashed #10B981;">
          <h4 style="color: #047857; margin-top:0;">🟢 Organic Tracking Active</h4>
          <p style="font-size: 13px; margin-bottom: 0px;">
            <strong>Test it live:</strong><br/>
            - Skip the video forward 15+ seconds = <strong>Surface Learning</strong><br/>
            - Rewind the video back 15+ seconds = <strong>Reviewing (Rewind)</strong><br/>
            - Pause the video rapidly 3+ times = <strong>Conceptual Block</strong>
          </p>
        </div>

        <h2>{{playingVideo()?.title}}</h2>
        
        <!-- YOUTUBE PLAYER CONFIG -->
        <youtube-player 
          [videoId]="playingVideo()?.youtube_id" 
          height="400" width="100%"
          (stateChange)="onPlayerStateChange($event)">
        </youtube-player>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { padding: 20px; font-family: sans-serif; background: #F3F4F6; min-height: 100vh; }
    header { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .logout { background: #DC2626; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor:pointer;}
    .tabs { margin-bottom: 20px; gap: 10px; display: flex; }
    .tabs button { padding: 10px 20px; border: none; cursor: pointer; background: #E5E7EB; border-radius: 4px; }
    .tabs button.active { background: #2563EB; color: white; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .card button { background: #10B981; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;}
    .player-container { background: white; padding: 20px; border-radius: 8px; max-width: 800px; margin: 0 auto;}
    .back { margin-bottom: 20px; background: transparent; border: 1px solid #ccc; padding: 5px 10px; cursor:pointer; }
    a { color: #2563EB; text-decoration: none; }
    a:hover { text-decoration: underline; }
  `]
})
export class StudentDashboardComponent implements OnInit {
  supabase = inject(SupabaseService);
  tab = signal('mycourses');
  allSubjects = signal<any[]>([]);
  enrolledSubjects = signal<any[]>([]);

  playingVideo = signal<any>(null);
  currentSubjectContext = signal<any>(null);

  // Tracking State
  pauseTimestamps: number[] = [];
  lastTime = 0;
  ytPlayer: any = null;
  trackerInterval: any = null;

  async ngOnInit() {
    // Add YouTube API Script dynamically for the player to work
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);

    await this.loadData();
  }

  async loadData() {
    const studentId = this.supabase.currentUser()?.id;
    // Load All
    const { data: all } = await this.supabase.supabase.from('subjects').select('*');
    this.allSubjects.set(all || []);

    // Load Enrolled
    const { data: enrolls } = await this.supabase.supabase.from('enrollments').select('subject_id').eq('student_id', studentId);
    if (enrolls?.length) {
      const ids = enrolls.map((e: any) => e.subject_id);
      const { data: mySubs } = await this.supabase.supabase.from('subjects').select('*, videos(*)').in('id', ids);
      this.enrolledSubjects.set(mySubs || []);
    }
  }

  async enroll(sub: any) {
    await this.supabase.supabase.from('enrollments').insert({
      student_id: this.supabase.currentUser()?.id, subject_id: sub.id
    });
    alert('Enrolled successfully!');
    this.loadData();
    this.tab.set('mycourses');
  }

  playVideo(vid: any, sub: any) {
    this.playingVideo.set(vid);
    this.currentSubjectContext.set(sub);
    this.pauseTimestamps = []; // reset tracker
    this.lastTime = 0;
    if (this.trackerInterval) clearInterval(this.trackerInterval);
  }

  // CORE MAGIC: Friction Tracking Logic
  async onPlayerStateChange(event: any) {
    const STATUS_PAUSED = 2;
    const STATUS_PLAYING = 1;
    this.ytPlayer = event.target;

    if (event.data === STATUS_PLAYING) {
      this.startTracking();
    } else {
      this.stopTracking();
      if (event.data === STATUS_PAUSED) {
        const currentTime = Math.floor(this.ytPlayer.getCurrentTime());
        this.pauseTimestamps.push(currentTime);

        // Conceptual block check: Paused 3 times around the same spot
        const nearPauses = this.pauseTimestamps.filter(t => Math.abs(t - currentTime) <= 3).length;
        if (nearPauses >= 3) {
          this.logFriction('Conceptual Block', currentTime);
          this.pauseTimestamps = []; // Reset after sending
        }
      }
    }
  }

  startTracking() {
    this.stopTracking();
    const currentTime = Math.floor(this.ytPlayer.getCurrentTime());

    // Check if they scrubbed the timeline while the video was paused
    if (this.lastTime > 0) {
      const diff = currentTime - this.lastTime;
      if (diff > 15) {
        this.logFriction('Surface Learning', currentTime);
      } else if (diff < -15) {
        this.logFriction('Reviewing (Rewind)', currentTime);
      }
    }

    this.lastTime = currentTime;

    // Poll every second while playing to catch live scrubs (if the player doesn't pause during scrub)
    this.trackerInterval = setInterval(() => {
      if (!this.ytPlayer) return;
      const curr = Math.floor(this.ytPlayer.getCurrentTime());
      const diff = curr - this.lastTime;

      if (diff > 15) {
        this.logFriction('Surface Learning', curr);
      } else if (diff < -10) {
        this.logFriction('Reviewing (Rewind)', curr);
      }

      // Usually playing progresses by 1 sec, so update lastTime normally
      this.lastTime = curr;
    }, 1000);
  }

  stopTracking() {
    if (this.trackerInterval) {
      clearInterval(this.trackerInterval);
      this.trackerInterval = null;
    }
  }

  async logFriction(type: string, time: number) {
    const user = this.supabase.userProfile();
    const vid = this.playingVideo();
    const sub = this.currentSubjectContext();

    console.log(`[Student] Creating friction log: Type: ${type}, Time: ${time}`);
    console.log('User profile:', user);
    console.log('Video Context:', vid);
    console.log('Subject Context:', sub);

    const { data, error } = await this.supabase.supabase.from('friction_logs').insert({
      student_id: user.id,
      tutor_id: sub.tutor_id,
      subject_id: sub.id,
      video_id: vid.id,
      student_name: user.full_name,
      subject_title: sub.title,
      video_title: vid.title,
      friction_type: type,
      timestamp_seconds: time
    });

    if (error) {
      console.error('[Student Error] Failed to insert friction log:', error);
      alert("Failed to send Friction alert: " + error.message);
    } else {
      console.log(`[Student Success] Friction Triggered: ${type} at ${time}s - Sent to Tutor!`, data);
    }
  }
}
