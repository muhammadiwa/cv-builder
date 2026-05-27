import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { TokenBudgetGuard } from '../common/token-budget.guard';

interface RewriteBody {
    sectionId: string;
    sectionType: string;
    content: Record<string, unknown>;
    field: string;
    instruction: string;
    selectedText?: string;
}

@Controller('api/v1/ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    /**
     * POST /api/v1/ai/rewrite
     *
     * Streams an AI-rewritten version of a resume field back to the client
     * via Server-Sent Events. The Vercel AI SDK's `toDataStreamResponse()`
     * produces a standard Response that we pipe through Express.
     */
    @Post('rewrite')
    @UseGuards(AuthGuard('jwt'), TokenBudgetGuard)
    async rewrite(
        @Req() req: any,
        @Body() body: RewriteBody,
        @Res() res: Response,
    ) {
        const userId = req.user.userId;

        const result = await this.aiService.rewrite({
            userId,
            sectionId: body.sectionId,
            sectionType: body.sectionType,
            content: body.content,
            field: body.field,
            instruction: body.instruction,
            selectedText: body.selectedText,
        });

        // Set SSE headers manually — NestJS @Sse() only works on GET endpoints.
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Pipe the Vercel AI SDK stream to the Express response.
        const stream = result.toDataStream();
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value, { stream: true }));
            }
        } catch (err) {
            // Client disconnected or stream error — log and close gracefully.
            if ((err as Error).name !== 'AbortError') {
                console.error('[AI Rewrite] Stream error:', err);
            }
        } finally {
            res.end();
        }
    }
}
