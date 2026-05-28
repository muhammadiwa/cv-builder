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

interface ATSImproveBody {
    dimensionKey: string;
    sectionId: string;
    sectionType: string;
    content: Record<string, unknown>;
    field: string;
}

@Controller('api/v1/ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    /**
     * POST /api/v1/ai/rewrite
     *
     * Streams an AI-rewritten version of a resume field back to the client
     * via Server-Sent Events. Uses @Res() for manual response control since
     * NestJS @Sse() only works on GET endpoints.
     *
     * IMPORTANT: Because we use @Res() without passthrough, NestJS's built-in
     * exception filter is bypassed. We must catch errors ourselves and send
     * appropriate JSON error responses before SSE headers are set.
     */
    @Post('rewrite')
    @UseGuards(AuthGuard('jwt'), TokenBudgetGuard)
    async rewrite(
        @Req() req: any,
        @Body() body: RewriteBody,
        @Res() res: Response,
    ) {
        const userId = req.user.userId;

        // Call the AI service BEFORE setting SSE headers. If it throws
        // (validation error, bad instruction, empty field), we can still
        // return a normal JSON error response.
        let result;
        try {
            result = await this.aiService.rewrite({
                userId,
                sectionId: body.sectionId,
                sectionType: body.sectionType,
                content: body.content,
                field: body.field,
                instruction: body.instruction,
                selectedText: body.selectedText,
            });
        } catch (err: any) {
            const status = err.status ?? err.getStatus?.() ?? 500;
            res.status(status).json({
                statusCode: status,
                message: err.message ?? 'AI rewrite failed',
            });
            return;
        }

        // Set SSE headers — from this point, errors go to the stream.
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

    /**
     * POST /api/v1/ai/ats-improve
     *
     * Streams an AI-generated improvement for a specific ATS dimension.
     * Same SSE pattern as /rewrite.
     */
    @Post('ats-improve')
    @UseGuards(AuthGuard('jwt'), TokenBudgetGuard)
    async atsImprove(
        @Req() req: any,
        @Body() body: ATSImproveBody,
        @Res() res: Response,
    ) {
        const userId = req.user.userId;

        let result;
        try {
            result = await this.aiService.atsImprove({
                userId,
                sectionId: body.sectionId,
                sectionType: body.sectionType,
                content: body.content,
                field: body.field,
                dimensionKey: body.dimensionKey,
            });
        } catch (err: any) {
            const status = err.status ?? err.getStatus?.() ?? 500;
            res.status(status).json({
                statusCode: status,
                message: err.message ?? 'ATS improve failed',
            });
            return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

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
            if ((err as Error).name !== 'AbortError') {
                console.error('[AI ATS-Improve] Stream error:', err);
            }
        } finally {
            res.end();
        }
    }
}
