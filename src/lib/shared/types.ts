// Gemeinsamer DTO-Typ für Meldungen (API + Frontend)
export interface ReportDto {
  id: number;
  title: string;
  description: string;
  image: string;
  lat: number;
  lon: number;
  area: string;
  upvotes: number;
  downvotes: number;
  score: number;
  resolved: boolean;
  flags: number;
  created_at: string;
}
