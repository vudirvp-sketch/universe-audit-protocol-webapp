// Universe Audit Protocol v10.0 - Skeleton Extraction API
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { getSkeletonExtractionPrompt } from '@/lib/audit/prompts';
import type { MediaType, Skeleton, GriefStage } from '@/lib/audit/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { narrative, mediaType } = body as { narrative: string; mediaType: MediaType };
    
    if (!narrative || typeof narrative !== 'string') {
      return NextResponse.json(
        { error: 'Narrative text is required' },
        { status: 400 }
      );
    }
    
    if (!mediaType) {
      return NextResponse.json(
        { error: 'Media type is required' },
        { status: 400 }
      );
    }
    
    const zai = await ZAI.create();
    
    const prompt = getSkeletonExtractionPrompt(narrative, mediaType);
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert narrative analyst. Extract structural elements from narratives.
Return only valid JSON with the requested fields. Use null for any element that cannot be extracted.
For emotionalEngine, use only: denial, anger, bargaining, depression, acceptance.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });
    
    const responseText = completion.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    let skeleton: Skeleton;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and construct skeleton
        skeleton = {
          thematicLaw: parsed.thematicLaw || null,
          rootTrauma: parsed.rootTrauma || null,
          hamartia: parsed.hamartia || null,
          pillars: Array.isArray(parsed.pillars) && parsed.pillars.length === 3
            ? parsed.pillars as [string, string, string]
            : [null, null, null],
          emotionalEngine: (parsed.emotionalEngine as GriefStage) || null,
          authorProhibition: parsed.authorProhibition || null,
          targetExperience: parsed.targetExperience || null,
          centralQuestion: parsed.centralQuestion || null,
        };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // Fallback skeleton if parsing fails
      skeleton = {
        thematicLaw: null,
        rootTrauma: null,
        hamartia: null,
        pillars: [null, null, null],
        emotionalEngine: null,
        authorProhibition: null,
        targetExperience: null,
        centralQuestion: null,
      };
    }
    
    return NextResponse.json({
      success: true,
      skeleton,
      rawResponse: responseText,
    });
    
  } catch (error) {
    console.error('Skeleton extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract skeleton', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
