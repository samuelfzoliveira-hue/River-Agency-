export interface InstagramProfileData {
  username: string;
  fullName: string;
  bio: string;
  profilePicUrl?: string;
  followers: number;
  following: number;
  posts: number;
  isVerified?: boolean;
  isPrivate?: boolean;
  externalUrl?: string;
  recentCaptions?: string[];
  avgLikes?: number;
  avgComments?: number;
  source: "scraped" | "manual" | "demo";
}

export interface ScoreBreakdown {
  label: string;
  score: number;
}

export interface EvolutionPhase {
  name: string;
  score: number;
  description: string;
}

export interface BioDiagnosis {
  currentBio: string;
  alignmentScore: number;
  analysis: string;
  problems: string[];
  idealBio: {
    promise: string;
    authority: string;
    cta: string;
  };
}

export interface EngagementAnalysis {
  rate: number;
  marketAverage: number;
  avgLikes: number;
  avgComments: number;
  analysis: string;
}

export interface Gap {
  title: string;
  description: string;
}

export interface Swot {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface MarketPositioning {
  currentQuadrant: string;
  targetQuadrant: string;
  summary: string;
  uniqueAdvantages: string[];
  gapsToFill: string[];
}

export interface Archetype {
  name: string;
  subtitle: string;
  whatItIs: string;
  inProfile: string;
  whatItMeansForYou: string;
}

export interface PersonaAnalysis {
  idealAvatar: string;
  pain: string;
  desire: string;
  contentAlignment: string;
  recommendations: string[];
}

export interface SuccessFormula {
  bestFormats: string[];
  contentPillars: { name: string; description: string }[];
  postingFrequency: string;
}

export interface BestTimes {
  weekdays: string[];
  weekends: string[];
}

export interface Summary {
  mainStrength: string;
  mainWeakness: string;
  opportunities: string[];
}

export interface DiagnosticReport {
  profile: {
    username: string;
    fullName: string;
    profilePicUrl?: string;
    followers: number;
    engagementRate: number;
  };
  overallScore: number;
  scoreBreakdown: ScoreBreakdown[];
  overallSummary: string;
  evolution: {
    current: number;
    phases: EvolutionPhase[];
  };
  bioDiagnosis: BioDiagnosis;
  engagement: EngagementAnalysis;
  gaps: Gap[];
  identityCrisisNote: string;
  swot: Swot;
  marketPositioning: MarketPositioning;
  archetypes: Archetype[];
  persona: PersonaAnalysis;
  successFormula: SuccessFormula;
  bestTimes: BestTimes;
  marketTrends: string[];
  finalRecommendations: string[];
  summary: Summary;
  generatedAt: string;
  dataSource: "scraped" | "manual" | "demo";
}

export interface AnalyzeRequestBody {
  instagramUrl: string;
  manualData?: Partial<InstagramProfileData>;
}
