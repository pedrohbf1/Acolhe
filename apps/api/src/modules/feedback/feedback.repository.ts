import { prisma } from "@/utils/db";

export interface CreateFeedbackInput {
  userId: string;
  type: string;
  subject: string;
  message: string;
}

export interface FeedbackFilters {
  page: number;
  limit: number;
  status?: string;
  type?: string;
}

export default class FeedbackRepository {
  async create(input: CreateFeedbackInput) {
    return prisma.feedback.create({ data: input });
  }

  async findAll({ page, limit, status, type }: FeedbackFilters) {
    const where: { status?: string; type?: string } = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      }),
      prisma.feedback.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateStatus(id: string, status: string, adminNote?: string) {
    return prisma.feedback.update({
      where: { id },
      data: { status, ...(adminNote !== undefined ? { adminNote } : {}) },
    });
  }
}
