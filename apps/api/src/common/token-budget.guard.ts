import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { prisma } from '@lolos/database';

/**
 * Token Budget Guardian — per-user daily AI cost cap.
 *
 * Checks `ai_usage_logs` for the current user's total cost today. If the
 * sum exceeds the daily budget ($0.10 ≈ Rp 1,600), the request is rejected
 * with 429 before any LLM tokens are consumed.
 *
 * The guard reads from the JWT-authenticated user (req.user.userId).
 */
const DAILY_BUDGET_USD = 0.10;

@Injectable()
export class TokenBudgetGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;

        if (!userId) return false;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const result = await prisma.aiUsageLog.aggregate({
            where: {
                userId,
                createdAt: { gte: todayStart },
            },
            _sum: { cost: true },
        });

        const totalCostToday = result._sum.cost ?? 0;

        if (totalCostToday >= DAILY_BUDGET_USD) {
            const res = context.switchToHttp().getResponse();
            res.status(429).json({
                statusCode: 429,
                message: 'Daily AI budget exceeded',
                error: 'Too Many Requests',
            });
            return false;
        }

        return true;
    }
}
