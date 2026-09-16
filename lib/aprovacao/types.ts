export type ContentType = "feed" | "carousel" | "story" | "reels";

export type ApprovalStatus = "pendente" | "aprovado" | "ajustes";

export interface MediaFile {
  url: string;
  kind: "image" | "video";
}

export interface ContentItem {
  id: string;
  type: ContentType;
  cliente: string;
  caption: string;
  media: MediaFile[];
  status: ApprovalStatus;
  clientNote: string;
  createdAt: string;
  updatedAt: string;
}
