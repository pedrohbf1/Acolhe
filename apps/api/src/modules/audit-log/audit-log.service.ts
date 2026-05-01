import AuditLogRepository from "./audit-log.repository";
import type { AuditLogFilters } from "./audit-log.repository";

export default class AuditLogService {
  constructor(private repository: AuditLogRepository) {}

  async getAll(params: AuditLogFilters & { requesterUserId: string }) {
    await this.assertOwner(params.requesterUserId, params.organizationId);
    const { requesterUserId: _ignored, ...filters } = params;
    void _ignored;
    return this.repository.findAll(filters);
  }

  async getFilterOptions(requesterUserId: string, organizationId: string) {
    await this.assertOwner(requesterUserId, organizationId);
    const [actions, resources] = await Promise.all([
      this.repository.getDistinctActions(organizationId),
      this.repository.getDistinctResources(organizationId),
    ]);
    return { actions, resources };
  }

  private async assertOwner(userId: string, organizationId: string) {
    const member = await this.repository.findOwnerMembership(
      userId,
      organizationId,
    );
    if (!member || !member.role.includes("owner")) {
      throw new Error("Apenas o owner pode ver os logs");
    }
  }
}
