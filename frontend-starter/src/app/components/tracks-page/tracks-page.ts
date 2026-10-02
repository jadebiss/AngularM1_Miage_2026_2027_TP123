import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];

@Component({
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  readonly audioUrl = signal('');
  readonly activeTrack = signal<Track | null>(null);
  readonly audioLoading = signal(false);
  readonly audioError = signal('');
  readonly title = new FormControl('', { nonNullable: true });
  readonly selectedFile = signal<File | null>(null);

  constructor() {
    this.load();
  }

  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.uploadError.set('');
    this.uploadSuccess.set('');

    if (file) {
      const validationError = this.validateFile(file);
      if (validationError) {
        this.selectedFile.set(null);
        input.value = '';
        this.uploadError.set(validationError);
        return;
      }
    }

    this.selectedFile.set(file);
    console.debug('[TracksPage] Fichier sélectionné', file?.name);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.list(this.page(), 5).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.loading.set(false);
      },
      error: (error: { error?: { message?: string } }) => {
        console.error('[TracksPage] Chargement impossible', error);
        this.error.set(error.error?.message ?? 'Impossible de charger les pistes.');
        this.loading.set(false);
      },
    });
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  upload(fileInput: HTMLInputElement): void {
    const file = this.selectedFile();
    if (!file || this.uploading()) return;

    const validationError = this.validateFile(file);
    if (validationError) {
      this.uploadError.set(validationError);
      return;
    }

    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.uploading.set(true);
    this.service.upload(file, this.title.value.trim() || file.name).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.uploading.set(false);
        this.uploadSuccess.set('La piste a été envoyée.');
        this.title.setValue('');
        this.selectedFile.set(null);
        fileInput.value = '';
        this.page.set(1);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Envoi impossible', error.status);
        this.uploading.set(false);
        this.uploadError.set(this.serverMessage(error, 'Échec de l’envoi de la piste.'));
      },
    });
  }

  play(track: Track): void {
    if (this.audioLoading()) return;

    this.releaseAudioUrl();
    this.audioUrl.set('');
    this.activeTrack.set(track);
    this.audioError.set('');
    this.audioLoading.set(true);

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        this.audioUrl.set(URL.createObjectURL(blob));
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Lecture impossible', error.status);
        this.audioLoading.set(false);
        this.audioError.set(this.serverMessage(error, 'Impossible de charger ce fichier audio.'));
      },
    });
  }

  onAudioReady(): void {
    this.audioLoading.set(false);
  }

  onAudioError(): void {
    this.audioLoading.set(false);
    this.audioError.set('Le navigateur ne peut pas lire ce fichier audio.');
  }

  ngOnDestroy(): void {
    this.releaseAudioUrl();
  }

  private validateFile(file: File): string {
    if (file.size > MAX_FILE_SIZE) {
      return 'Le fichier dépasse la taille maximale de 25 Mo.';
    }

    const fileName = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
      return 'Format non accepté. Choisissez un fichier MP3, WAV, OGG ou M4A.';
    }

    return '';
  }

  private serverMessage(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.message;
    return typeof message === 'string' ? message : fallback;
  }

  private releaseAudioUrl(): void {
    const url = this.audioUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
