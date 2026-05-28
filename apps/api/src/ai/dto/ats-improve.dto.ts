import { IsString, IsObject, IsIn } from 'class-validator';

const IMPROVABLE_DIMENSIONS = ['keywordMatch', 'readability', 'metricsImpact', 'optimization'] as const;

export class ATSImproveDto {
    @IsIn(IMPROVABLE_DIMENSIONS, {
        message: `dimensionKey must be one of: ${IMPROVABLE_DIMENSIONS.join(', ')}`,
    })
    dimensionKey!: string;

    @IsString()
    sectionId!: string;

    @IsString()
    sectionType!: string;

    @IsObject()
    content!: Record<string, unknown>;

    @IsString()
    field!: string;
}
