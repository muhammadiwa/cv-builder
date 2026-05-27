/**
 * Prompt templates for the 4 inline rewrite instructions.
 *
 * Each template receives the section type as context so the model knows
 * whether it's rewriting a "summary" paragraph or an "experience" bullet.
 * The `selectedText` variant is used when the user highlights a portion
 * of the field (AC-6).
 */

export type RewriteInstruction =
    | 'perbaiki_wording'
    | 'ats_friendly'
    | 'singkat'
    | 'tambah_metrik';

const SYSTEM_PREFIX = `You are a professional resume writing assistant for Indonesian job seekers. You help improve CV content to be more impactful and ATS-friendly. Always respond in the same language as the input text (Bahasa Indonesia or English). Return ONLY the rewritten text — no explanations, no markdown formatting, no quotes.`;

const INSTRUCTION_TEMPLATES: Record<RewriteInstruction, string> = {
    perbaiki_wording:
        'Rewrite this resume text to be more professional and impactful. Keep the same meaning but improve clarity, word choice, and flow. Use active verbs.',
    ats_friendly:
        'Rewrite this resume text to be more ATS-friendly. Use industry-standard keywords, active verbs, and quantifiable achievements. Avoid creative formatting.',
    singkat:
        'Condense this resume text into a single concise line (max 15 words) without losing key information or impact.',
    tambah_metrik:
        'Enhance this resume text by adding specific metrics, numbers, or quantifiable results where possible. If exact numbers are unknown, use realistic placeholders like "X%" or "Y+ clients".',
};

export interface RewritePromptParams {
    instruction: RewriteInstruction;
    sectionType: string;
    fieldContent: string;
    selectedText?: string;
}

export function buildRewritePrompt(params: RewritePromptParams): {
    system: string;
    user: string;
} {
    const { instruction, sectionType, fieldContent, selectedText } = params;

    const instructionText = INSTRUCTION_TEMPLATES[instruction];
    if (!instructionText) {
        throw new Error(`Unknown rewrite instruction: ${instruction}`);
    }

    const system = SYSTEM_PREFIX;

    let user: string;
    if (selectedText) {
        user = `Section type: ${sectionType}\nInstruction: ${instructionText}\n\nFull context:\n${fieldContent}\n\nRewrite ONLY this selected portion:\n${selectedText}`;
    } else {
        user = `Section type: ${sectionType}\nInstruction: ${instructionText}\n\nText to rewrite:\n${fieldContent}`;
    }

    return { system, user };
}

export function isValidInstruction(value: string): value is RewriteInstruction {
    return ['perbaiki_wording', 'ats_friendly', 'singkat', 'tambah_metrik'].includes(value);
}
