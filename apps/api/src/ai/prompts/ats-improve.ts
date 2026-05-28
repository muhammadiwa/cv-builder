/**
 * Prompt templates for ATS dimension-specific improvements.
 *
 * Only 4 dimensions are improvable via AI text rewrite:
 * - keywordMatch, readability, metricsImpact, optimization
 *
 * completeness (requires adding sections) and formatting (requires
 * structural HTML changes) are NOT handled here.
 */

export type ImprovableDimension =
    | 'keywordMatch'
    | 'readability'
    | 'metricsImpact'
    | 'optimization';

const ALL_IMPROVABLE: ImprovableDimension[] = [
    'keywordMatch',
    'readability',
    'metricsImpact',
    'optimization',
];

const SYSTEM_PREFIX = `You are a professional resume optimization assistant for Indonesian job seekers. Your goal is to improve specific ATS scoring dimensions. Always respond in the same language as the input text (Bahasa Indonesia or English). Return ONLY the improved text — no explanations, no markdown formatting, no quotes.`;

const DIMENSION_INSTRUCTIONS: Record<ImprovableDimension, string> = {
    keywordMatch:
        'Enhance this resume text by naturally incorporating industry-relevant keywords and phrases that ATS systems look for. Add role-specific terminology, technical skills, and action verbs without making the text sound forced or keyword-stuffed.',
    readability:
        'Improve the readability of this resume text. Shorten sentences longer than 20 words, replace passive voice with active voice, reduce jargon, and make the text scannable. Keep the meaning intact.',
    metricsImpact:
        'Enhance this resume text by adding quantifiable metrics, numbers, percentages, or measurable outcomes. If exact numbers are unknown, use realistic placeholders like "X%", "Y+ clients", or "$Z revenue". Every bullet should ideally contain at least one number.',
    optimization:
        'Optimize this resume text structure: start each bullet with a strong action verb, ensure 3-5 bullets per entry, keep each bullet to 1-2 lines, and tighten wording for maximum impact per word.',
};

export interface ATSImprovePromptParams {
    dimensionKey: ImprovableDimension;
    sectionType: string;
    fieldContent: string;
}

export function buildATSImprovePrompt(params: ATSImprovePromptParams): {
    system: string;
    user: string;
} {
    const { dimensionKey, sectionType, fieldContent } = params;

    const instruction = DIMENSION_INSTRUCTIONS[dimensionKey];
    if (!instruction) {
        throw new Error(`Unknown or non-improvable dimension: ${dimensionKey}`);
    }

    return {
        system: SYSTEM_PREFIX,
        user: `Section type: ${sectionType}\nDimension to improve: ${dimensionKey}\nInstruction: ${instruction}\n\nText to improve:\n${fieldContent}`,
    };
}

export function isImprovableDimension(value: string): value is ImprovableDimension {
    return ALL_IMPROVABLE.includes(value as ImprovableDimension);
}
