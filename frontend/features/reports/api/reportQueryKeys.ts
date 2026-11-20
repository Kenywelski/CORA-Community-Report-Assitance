export const reportQueryKeys = {
  all: ['reports'] as const,
  myReports: (userId: string | undefined) =>
    [...reportQueryKeys.all, 'mine', userId] as const,
  myReportSummary: (userId: string | undefined) =>
    [...reportQueryKeys.all, 'mine', userId, 'summary'] as const,
  publicFeed: () => [...reportQueryKeys.all, 'public-feed'] as const,
  comments: (reportId: string | undefined) =>
    [...reportQueryKeys.all, reportId, 'comments'] as const,
  follows: (reportId: string | undefined) =>
    [...reportQueryKeys.all, reportId, 'follows'] as const,
};
