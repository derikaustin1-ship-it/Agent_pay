// src/app/api/test/gemini/route.ts
// Test endpoint for official Google GenAI SDK integration

import { NextRequest, NextResponse } from 'next/server';
import { analyzeShoppingRequest, isGeminiConfigured } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleTest('Find wireless headphones under $100.');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt || 'Find wireless headphones under $100.';
    return handleTest(prompt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

async function handleTest(prompt: string) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'GEMINI_API_KEY is not configured in .env.local. Please set GEMINI_API_KEY to test the integration.',
        sdk: '@google/genai',
      },
      { status: 503 }
    );
  }

  try {
    const analysis = await analyzeShoppingRequest(prompt);

    return NextResponse.json({
      success: true,
      sdk: '@google/genai',
      testPrompt: prompt,
      data: analysis,
      diagnostics: {
        extractedCategory: analysis.productCategory,
        extractedBudget: analysis.maxBudget,
        currency: analysis.currency,
        preferencesCount: analysis.preferences.length,
        featuresCount: analysis.importantFeatures.length,
      },
    });
  } catch (error: unknown) {
    console.error('Gemini test endpoint error:', error);
    const message = error instanceof Error ? error.message : 'Gemini API call failed';
    return NextResponse.json(
      {
        success: false,
        error: message,
        sdk: '@google/genai',
      },
      { status: 500 }
    );
  }
}

