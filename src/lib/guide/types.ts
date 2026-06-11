export interface GuideSubscriberRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  guideSlug: string;
  leadId: string | null;
  welcomeEmailSent: boolean;
  welcomeEmailError: string | null;
  createdAt: string;
}

export interface CreateGuideSubscriberResult {
  subscriberId: string;
  password: string;
  email: string;
  name: string;
  isNew: boolean;
}
