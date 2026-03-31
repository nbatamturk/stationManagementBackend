import { dashboardRepository, type DashboardRepository } from './dashboard.repository';

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  async getSummary() {
    return this.repository.getSummary();
  }

  async getRecentStations(limit?: number) {
    return this.repository.listRecentStations(this.normalizeLimit(limit));
  }

  async getRecentIssues(limit?: number) {
    return this.repository.listRecentIssues(this.normalizeLimit(limit));
  }

  async getRecentTests(limit?: number) {
    return this.repository.listRecentTests(this.normalizeLimit(limit));
  }

  private normalizeLimit(limit?: number) {
    if (!limit) {
      return 5;
    }

    return Math.min(Math.max(limit, 1), 50);
  }
}

export const dashboardService = new DashboardService();
