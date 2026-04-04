// Universe Audit Protocol v10.0 - Quick Screening API
import { NextRequest, NextResponse } from 'next/server';
import { getZAIClient } from '@/lib/zai-client';
import { getScreeningPrompt } from '@/lib/audit/prompts';
import type { ScreeningResult } from '@/lib/audit/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { narrative, apiKey } = body as { narrative: string; apiKey?: string | null };
    
    if (!narrative || typeof narrative !== 'string') {
      return NextResponse.json(
        { error: 'Narrative text is required' },
        { status: 400 }
      );
    }
    
    // Use provided API key or fall back to environment variable
    const zai = await getZAIClient(apiKey);
    
    const prompt = getScreeningPrompt(narrative);
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert narrative auditor. Perform quick screening and return only valid JSON.
Your response must be a valid JSON object with the specified structure.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });
    
    const responseText = completion.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    let screeningResult: ScreeningResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        const answers = parsed.answers as boolean[];
        
        // Generate flags based on NO answers
        const flags: string[] = [];
        if (!answers[0]) flags.push('§0', '§1.4');
        if (!answers[1]) flags.push('§3', '§4');
        if (!answers[2]) flags.push('§1.5', '§5');
        if (!answers[3]) flags.push('§6');
        if (!answers[4]) flags.push('§2', '§16');
        if (!answers[5]) flags.push('§6', '§8');
        if (!answers[6]) flags.push('§16');
        
        // Determine recommendation
        const noCount = answers.filter(a => !a).length;
        let recommendation: ScreeningResult['recommendation'];
        if (noCount <= 1) {
          recommendation = 'ready_for_audit';
        } else if (noCount <= 3) {
          recommendation = 'requires_sections';
        } else {
          recommendation = 'stop_return_to_skeleton';
        }
        
        screeningResult = {
          question1_thematicLaw: answers[0],
          question2_worldWithoutProtagonist: answers[1],
          question3_embodiment: answers[2],
          question4_hamartia: answers[3],
          question5_painfulChoice: answers[4],
          question6_antagonistLogic: answers[5],
          question7_finalIrreversible: answers[6],
          flags,
          recommendation,
        };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // Fallback if parsing fails
      screeningResult = {
        question1_thematicLaw: false,
        question2_worldWithoutProtagonist: false,
        question3_embodiment: false,
        question4_hamartia: false,
        question5_painfulChoice: false,
        question6_antagonistLogic: false,
        question7_finalIrreversible: false,
        flags: ['§0', '§1.4', '§3', '§4', '§1.5', '§5', '§6', '§2', '§16', '§8'],
        recommendation: 'stop_return_to_skeleton',
      };
    }
    
    return NextResponse.json({
      success: true,
      screeningResult,
      rawResponse: responseText,
    });
    
  } catch (error) {
    console.error('Screening error:', error);
    return NextResponse.json(
      { error: 'Failed to perform screening', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
