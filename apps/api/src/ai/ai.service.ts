import { Injectable, BadRequestException } from '@nestjs/common';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { prisma } from '@lolos/database';
import { PiiGatewayService } from '../common/pii-gateway.service';
import {
    buildRewritePrompt,
    isValidInstruction,
    type RewriteInstruction,
} from './prompts/rewrite';
import {
    buildATSImprovePrompt,
    isImprovableDimension,
    type ImprovableDimension,
} from './prompts/ats-improve';

export interface RewriteParams {
    userId: string;
    sectionId: string;
    sectionType: string;
    content: Record<string, unknown>;
    field: string;
    instruction: string;
    selectedText?: string;
}

export interface ATSImproveParams {
    userId: string;
    sectionId: string;
    sectionType: string;
    content: Record<string, unknown>;
    field: string;
    dimensionKey: string;
}

@Injectable()
export class AiService {
    constructor(private readonly piiGateway: PiiGatewayService) { }

    async rewrite(params: RewriteParams) {
        const { userId, sectionType, content, field, instruction, selectedText } = params;

        if (!isValidInstruction(instruction)) {
            throw new BadRequestException(
                `Invalid instruction: ${instruction}. Must be one of: perbaiki_wording, ats_friendly, singkat, tambah_metrik`,
            );
        }

        // Extract the target field value from content
        const fieldContent = content[field];
        if (typeof fieldContent !== 'string' || !fieldContent.trim()) {
            throw new BadRequestException(
                `Field "${field}" is empty or not a string — nothing to rewrite.`,
            );
        }

        // Strip PII before sending to LLM
        const sanitizedContent = this.piiGateway.sanitize(
            { fieldContent, ...(selectedText ? { selectedText } : {}) },
            userId,
        );

        const prompt = buildRewritePrompt({
            instruction: instruction as RewriteInstruction,
            sectionType,
            fieldContent: sanitizedContent.fieldContent,
            selectedText: sanitizedContent.selectedText,
        });

        // Stream from GPT-4o-mini (cost target: Rp 10-20 per rewrite)
        const result = streamText({
            model: openai('gpt-4o-mini'),
            system: prompt.system,
            prompt: prompt.user,
            temperature: 0.7,
            maxTokens: 500,
        });

        // Log usage after stream completes (fire-and-forget).
        // `streamText` returns a StreamTextResult which exposes `usage` as a
        // promise property, not via `.then()` on the result itself.
        result.usage.then((usage) => {
            if (usage) {
                prisma.aiUsageLog.create({
                    data: {
                        userId,
                        operationType: `rewrite_${instruction}`,
                        modelUsed: 'gpt-4o-mini',
                        tokensIn: usage.promptTokens ?? 0,
                        tokensOut: usage.completionTokens ?? 0,
                        // GPT-4o-mini pricing: ~$0.15/1M input, ~$0.60/1M output
                        cost: ((usage.promptTokens ?? 0) * 0.00000015) +
                            ((usage.completionTokens ?? 0) * 0.0000006),
                    },
                }).catch((err) => {
                    console.error('[AI] Failed to log usage:', err);
                });
            }
        }).catch(() => {
            // Stream itself may fail — usage logging is best-effort
        });

        return result;
    }

    async atsImprove(params: ATSImproveParams) {
        const { userId, sectionType, content, field, dimensionKey } = params;

        if (!isImprovableDimension(dimensionKey)) {
            throw new BadRequestException(
                `Dimension "${dimensionKey}" is not improvable via AI. Only: keywordMatch, readability, metricsImpact, optimization`,
            );
        }

        const fieldContent = content[field];
        if (typeof fieldContent !== 'string' || !fieldContent.trim()) {
            throw new BadRequestException(
                `Field "${field}" is empty or not a string — nothing to improve.`,
            );
        }

        // Strip PII before sending to LLM
        const sanitized = this.piiGateway.sanitize({ fieldContent }, userId);

        const prompt = buildATSImprovePrompt({
            dimensionKey,
            sectionType,
            fieldContent: sanitized.fieldContent,
        });

        const result = streamText({
            model: openai('gpt-4o-mini'),
            system: prompt.system,
            prompt: prompt.user,
            temperature: 0.7,
            maxTokens: 500,
        });

        // Log usage (fire-and-forget)
        result.usage.then((usage) => {
            if (usage) {
                prisma.aiUsageLog.create({
                    data: {
                        userId,
                        operationType: `ats_improve_${dimensionKey}`,
                        modelUsed: 'gpt-4o-mini',
                        tokensIn: usage.promptTokens ?? 0,
                        tokensOut: usage.completionTokens ?? 0,
                        cost: ((usage.promptTokens ?? 0) * 0.00000015) +
                            ((usage.completionTokens ?? 0) * 0.0000006),
                    },
                }).catch((err) => {
                    console.error('[AI] Failed to log ats-improve usage:', err);
                });
            }
        }).catch(() => { });

        return result;
    }
}
